#!/usr/bin/env python3
"""Generate apps/api/src/database/migrations/052_seed_anatomy.sql from the
'Kinesiology and Myology.xlsx' spreadsheet.

The spreadsheet's 'Muscles' sheet is the source of truth (muscle x joint x
action rows). This script canonicalises that data and augments it with
anatomical reference detail (innervation, blood supply, plain-language
descriptions, movement planes/axes, prime-mover designation, and fixators)
that is not present in the sheet, then emits idempotent INSERT statements.

Re-run after editing the spreadsheet or the augmentation tables below:
    .kvenv/bin/python scripts/gen_anatomy_seed.py
"""
import os
import re
import openpyxl
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "Kinesiology and Myology.xlsx")
OUT = os.path.join(ROOT, "apps/api/src/database/migrations/052_seed_anatomy.sql")


def slugify(s):
    s = s.strip().lower()
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def q(v):
    """SQL string literal (or NULL)."""
    if v is None or v == "":
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


# ── Joint reference metadata (augmentation) ───────────────────────────────────
JOINTS = OrderedDict([
    ("Scapulothoracic", dict(
        region="Shoulder girdle", joint_type="Functional (physiological)",
        description="The gliding articulation of the scapula on the posterior "
        "thoracic wall. Not a true synovial joint, but its coordinated motion "
        "(scapulohumeral rhythm) is essential to full overhead reach.")),
    ("Glenohumeral", dict(
        region="Shoulder", joint_type="Ball-and-socket (synovial)",
        description="The shoulder joint proper: the humeral head in the shallow "
        "glenoid fossa. The most mobile — and least stable — joint in the body, "
        "relying on the rotator cuff for dynamic stability.")),
    ("Elbow", dict(
        region="Arm", joint_type="Hinge (synovial)",
        description="The humero-ulnar and humero-radial hinge that flexes and "
        "extends the forearm.")),
    ("Forearm", dict(
        region="Forearm", joint_type="Pivot (radio-ulnar)",
        description="The proximal and distal radio-ulnar joints, which together "
        "rotate the forearm into pronation and supination.")),
    ("Wrist", dict(
        region="Wrist", joint_type="Condyloid (synovial)",
        description="The radiocarpal joint, allowing flexion/extension and "
        "radial/ulnar deviation of the hand.")),
    ("Fingers", dict(
        region="Hand", joint_type="Condyloid / hinge (synovial)",
        description="The metacarpophalangeal (MP) and interphalangeal (PIP/DIP) "
        "joints of the digits.")),
    ("Spine", dict(
        region="Trunk", joint_type="Cartilaginous / facet (synovial)",
        description="The intervertebral and zygapophyseal (facet) joints of the "
        "vertebral column, permitting extension, flexion and lateral flexion of "
        "the trunk.")),
])

# ── Action reference metadata (augmentation) ──────────────────────────────────
# name -> (plane, axis, opposite_name_or_None, description)
ACTIONS = {
    "Flexion": ("Sagittal", "Frontal (mediolateral)", "Extension",
                "Decreasing the angle between two segments."),
    "Extension": ("Sagittal", "Frontal (mediolateral)", "Flexion",
                  "Increasing the angle between two segments."),
    "Abduction": ("Frontal", "Sagittal (antero-posterior)", "Adduction",
                  "Moving a segment away from the midline."),
    "Adduction": ("Frontal", "Sagittal (antero-posterior)", "Abduction",
                  "Moving a segment toward the midline."),
    "Internal Rotation": ("Transverse", "Longitudinal (vertical)", "External Rotation",
                          "Rotating a segment medially about its long axis."),
    "External Rotation": ("Transverse", "Longitudinal (vertical)", "Internal Rotation",
                          "Rotating a segment laterally about its long axis."),
    "Horizontal Adduction": ("Transverse", "Longitudinal (vertical)", "Horizontal Abduction",
                             "Drawing the arm across the body in the transverse plane."),
    "Horizontal Abduction": ("Transverse", "Longitudinal (vertical)", "Horizontal Adduction",
                             "Drawing the arm back and out in the transverse plane."),
    "Elevation": ("Frontal", "Sagittal (antero-posterior)", "Depression",
                  "Lifting the scapula superiorly (shrugging)."),
    "Depression": ("Frontal", "Sagittal (antero-posterior)", "Elevation",
                   "Drawing the scapula inferiorly."),
    "Retraction": ("Transverse", "Longitudinal (vertical)", "Protraction",
                   "Drawing the scapula toward the spine (squeezing the shoulder blades)."),
    "Upward Rotation": ("Frontal", "Sagittal (antero-posterior)", "Downward Rotation",
                        "Turning the glenoid fossa upward, pairing with arm elevation."),
    "Downward Rotation": ("Frontal", "Sagittal (antero-posterior)", "Upward Rotation",
                          "Returning the glenoid fossa downward from elevation."),
    "Lateral Flexion": ("Frontal", "Sagittal (antero-posterior)", None,
                        "Side-bending the trunk; the contralateral side acts as the antagonist."),
    "Pronation": ("Transverse", "Longitudinal (vertical)", "Supination",
                  "Rotating the forearm so the palm faces down/back."),
    "Supination": ("Transverse", "Longitudinal (vertical)", "Pronation",
                   "Rotating the forearm so the palm faces up/forward."),
    "Radial Deviation": ("Frontal", "Sagittal (antero-posterior)", "Ulnar Deviation",
                         "Tilting the hand toward the thumb (radial) side."),
    "Ulnar Deviation": ("Frontal", "Sagittal (antero-posterior)", "Radial Deviation",
                        "Tilting the hand toward the little-finger (ulnar) side."),
    "Extension (MP joint)": ("Sagittal", "Frontal (mediolateral)", "Flexion",
                             "Straightening the fingers at the knuckles (metacarpophalangeal joints)."),
    "Flexion (DIP joint)": ("Sagittal", "Frontal (mediolateral)", "Extension (MP joint)",
                            "Curling the fingertip at the distal interphalangeal joint."),
}

# ── Muscle reference metadata (augmentation), keyed by base muscle name ────────
# name -> (innervation, blood_supply, description)
MUSCLE_INFO = {
    "Trapezius": ("Accessory nerve (CN XI); C3-C4 (proprioception)", "Transverse cervical artery",
                  "Large superficial diamond of the upper back; its three functional regions move the scapula independently."),
    "Rhomboid": ("Dorsal scapular nerve (C4-C5)", "Dorsal scapular artery",
                 "Lies deep to trapezius; retracts and downwardly rotates the scapula."),
    "Levator scapulae": ("Dorsal scapular nerve (C5) and C3-C4", "Dorsal scapular & transverse cervical arteries",
                         "Strap muscle of the neck that elevates the scapula and assists downward rotation."),
    "Teres Major": ("Lower subscapular nerve (C5-C6)", "Subscapular & circumflex scapular arteries",
                    "The 'lat's little helper' — works with latissimus dorsi to extend, adduct and internally rotate the arm."),
    "Latissimus dorsi": ("Thoracodorsal nerve (C6-C8)", "Thoracodorsal artery",
                         "Broad muscle of the back; the prime mover of arm extension and adduction (the pulling/swimming muscle)."),
    "Quadratus lumborum": ("Subcostal nerve & lumbar plexus (T12-L4)", "Lumbar & subcostal arteries",
                           "Deep posterior abdominal wall muscle that laterally flexes the trunk and stabilises the 12th rib."),
    "Iliocostalis": ("Dorsal rami of spinal nerves", "Posterior intercostal & lumbar arteries",
                     "The most lateral erector spinae column; extends and laterally flexes the spine."),
    "Longissimus": ("Dorsal rami of spinal nerves", "Posterior intercostal & lumbar arteries",
                    "The largest, intermediate erector spinae column running the length of the back."),
    "Spinalis": ("Dorsal rami of spinal nerves", "Posterior intercostal arteries",
                 "The most medial erector spinae column, closest to the spinous processes."),
    "Supraspinatus": ("Suprascapular nerve (C5-C6)", "Suprascapular artery",
                      "Rotator cuff muscle that initiates the first ~15 degrees of arm abduction and centres the humeral head."),
    "Infraspinatus": ("Suprascapular nerve (C5-C6)", "Suprascapular & circumflex scapular arteries",
                      "Rotator cuff muscle; the chief external rotator of the shoulder."),
    "Teres minor": ("Axillary nerve (C5-C6)", "Circumflex scapular artery",
                    "Smallest rotator cuff muscle, assisting external rotation."),
    "Subscapularis": ("Upper & lower subscapular nerves (C5-C6)", "Subscapular artery",
                      "The only rotator cuff muscle on the front of the scapula; the prime internal rotator of the shoulder."),
    "Coracobrachialis": ("Musculocutaneous nerve (C5-C7)", "Brachial artery branches",
                         "Slender muscle running from the coracoid; flexes and adducts the shoulder."),
    "Deltoid": ("Axillary nerve (C5-C6)", "Posterior circumflex humeral & thoracoacromial arteries",
                "Cap of the shoulder with three heads that flex, abduct and extend the arm respectively."),
    "Biceps Brachii": ("Musculocutaneous nerve (C5-C6)", "Brachial artery",
                       "Two-headed flexor of the elbow and powerful supinator of the forearm."),
    "Brachialis": ("Musculocutaneous nerve (C5-C6); small radial contribution", "Brachial & radial recurrent arteries",
                   "The workhorse of elbow flexion, working in every forearm position regardless of grip."),
    "Brachioradialis": ("Radial nerve (C5-C6)", "Radial recurrent artery",
                        "Elbow flexor most effective in the mid-prone (hammer-grip) position."),
    "Triceps Brachii": ("Radial nerve (C6-C8)", "Deep brachial (profunda brachii) artery",
                        "Three-headed prime extensor of the elbow; the long head also extends the shoulder."),
    "Anconeus": ("Radial nerve (C7-C8)", "Deep brachial & recurrent interosseous arteries",
                 "Small triangular muscle assisting elbow extension and stabilising the joint capsule."),
    "Flexor Carpi Radialis": ("Median nerve (C6-C7)", "Ulnar & radial arteries",
                              "Superficial flexor producing wrist flexion and radial deviation."),
    "Flexor Carpi Ulnaris": ("Ulnar nerve (C7-C8)", "Ulnar artery",
                             "Most medial of the superficial flexors; flexes and ulnar-deviates the wrist."),
    "Palmaris Longus": ("Median nerve (C7-C8)", "Ulnar artery",
                        "Variable, often-absent muscle that tenses the palmar aponeurosis and weakly flexes the wrist."),
    "Flexor Digitorum Superficialis": ("Median nerve (C7-T1)", "Ulnar & radial arteries",
                                       "Intermediate-layer muscle flexing the fingers at the PIP joints and assisting wrist flexion."),
    "Flexor Digitorum Profundus": ("Median (lateral half) & ulnar (medial half) nerves (C8-T1)", "Ulnar & anterior interosseous arteries",
                                   "Deep muscle and the only one able to flex the fingertips at the DIP joints."),
    "Extensor Carpi Radialis Longus": ("Radial nerve (C6-C7)", "Radial artery",
                                       "Extends and radially deviates the wrist; a key wrist stabiliser during gripping."),
    "Extensor Carpi Radialis Brevis": ("Deep branch of radial / posterior interosseous nerve (C7-C8)", "Radial artery",
                                       "Primary wrist extensor; its origin is a common site of lateral epicondylitis (tennis elbow)."),
    "Extensor Carpi Ulnaris": ("Posterior interosseous nerve (C7-C8)", "Posterior interosseous artery",
                               "Extends and ulnar-deviates the wrist."),
    "Extensor Digitorum": ("Posterior interosseous nerve (C7-C8)", "Posterior interosseous artery",
                           "Principal extensor of the fingers at the metacarpophalangeal joints."),
    "Supinator": ("Posterior interosseous nerve (C5-C6)", "Radial recurrent & posterior interosseous arteries",
                  "Wraps the proximal radius; supinates the forearm, especially when the elbow is extended."),
    "Pronator Teres": ("Median nerve (C6-C7)", "Ulnar & radial arteries",
                       "Two-headed muscle that pronates the forearm and weakly flexes the elbow."),
    "Pronator Quadratus": ("Anterior interosseous nerve (C8-T1)", "Anterior interosseous artery",
                           "Deep, square muscle that is the prime mover of forearm pronation."),
}

# ── Prime-mover (agonist) designation: (joint, action) -> muscle display label ─
PRIME_MOVERS = {
    ("Scapulothoracic", "Elevation"): "Trapezius - Upper",
    ("Scapulothoracic", "Depression"): "Trapezius - Lower",
    ("Scapulothoracic", "Retraction"): "Trapezius - Middle",
    ("Scapulothoracic", "Upward Rotation"): "Trapezius - Upper",
    ("Scapulothoracic", "Downward Rotation"): "Rhomboid - Major",
    ("Glenohumeral", "Abduction"): "Deltoid - Middle",
    ("Glenohumeral", "Adduction"): "Latissimus dorsi",
    ("Glenohumeral", "Extension"): "Latissimus dorsi",
    ("Glenohumeral", "Flexion"): "Deltoid - Anterior",
    ("Glenohumeral", "Internal Rotation"): "Subscapularis",
    ("Glenohumeral", "External Rotation"): "Infraspinatus",
    ("Glenohumeral", "Horizontal Adduction"): "Deltoid - Anterior",
    ("Glenohumeral", "Horizontal Abduction"): "Deltoid - Posterior",
    ("Elbow", "Flexion"): "Brachialis",
    ("Elbow", "Extension"): "Triceps Brachii - Medial Head",
    ("Forearm", "Pronation"): "Pronator Quadratus",
    ("Forearm", "Supination"): "Supinator",
    ("Wrist", "Flexion"): "Flexor Carpi Radialis",
    ("Wrist", "Extension"): "Extensor Carpi Radialis Brevis",
    ("Wrist", "Radial Deviation"): "Extensor Carpi Radialis Longus",
    ("Wrist", "Ulnar Deviation"): "Flexor Carpi Ulnaris - Humeral",
    ("Spine", "Extension"): "Longissimus",
    ("Spine", "Lateral Flexion"): "Quadratus lumborum",
    ("Fingers", "Flexion"): "Flexor Digitorum Superficialis - Humeral Head",
    ("Fingers", "Flexion (DIP joint)"): "Flexor Digitorum Profundus",
    ("Fingers", "Extension (MP joint)"): "Extensor Digitorum",
}

# ── Fixators (augmentation): joint -> (muscle_group filter, note) ──────────────
# Muscles in the named group(s) act as fixators stabilising a proximal segment.
FIXATORS = {
    "Glenohumeral": (["Scapular Stabilizer"],
                     "Stabilises the scapula, giving the glenohumeral muscles a fixed base to pull against."),
    "Elbow": (["Scapular Stabilizer", "Rotator Cuff"],
              "Stabilises the scapula and humeral head so force is transmitted across the elbow."),
    "Forearm": (["Elbow Flexors", "Elbow Extensors"],
                "Stabilises the elbow so rotation occurs at the radio-ulnar joints alone."),
    "Wrist": (["Elbow Flexors", "Elbow Extensors"],
              "Stabilises the elbow and forearm to give the wrist movers a fixed origin."),
    "Fingers": (["Wrist Flexors", "Wrist Extensors"],
                "Wrist muscles co-contract to hold the wrist steady while the long finger tendons move the digits."),
    "Scapulothoracic": (["Spinal Extensor", "Trunk Stabilizer"],
                        "Axial muscles stabilise the spine and ribcage as a base for scapular motion."),
}


def label(name, sub):
    return name + (" - " + sub if sub else "")


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    rows = [r[:8] for r in wb["Muscles"].iter_rows(values_only=True)][1:]
    rows = [r for r in rows if r[0]]

    # Canonicalise muscles (first occurrence wins for origin/insertion/group/depth).
    muscles = OrderedDict()      # display_label -> dict
    triples = []                 # (muscle_label, joint, action)
    for name, sub, group, joint, action, origin, insertion, depth in rows:
        name = name.strip()
        sub = (sub or "").strip() or None
        lab = label(name, sub)
        if lab not in muscles:
            info = MUSCLE_INFO.get(name, (None, None, None))
            muscles[lab] = dict(
                slug=slugify(lab), name=name, subdivision=sub, display_name=lab,
                group=group, origin=origin, insertion=insertion, depth=depth,
                innervation=info[0], blood=info[1], description=info[2],
            )
        triples.append((lab, joint.strip(), action.strip()))

    out = []
    out.append("-- AUTO-GENERATED by scripts/gen_anatomy_seed.py — do not edit by hand.")
    out.append("-- Source: 'Kinesiology and Myology.xlsx' (Muscles sheet) + curated augmentation.\n")

    # Joints
    out.append("INSERT INTO joints (slug, name, region, joint_type, description, display_order) VALUES")
    jvals = []
    for i, (jname, meta) in enumerate(JOINTS.items()):
        jvals.append("  (%s, %s, %s, %s, %s, %d)" % (
            q(slugify(jname)), q(jname), q(meta["region"]), q(meta["joint_type"]),
            q(meta["description"]), i))
    out.append(",\n".join(jvals) + "\nON CONFLICT (slug) DO NOTHING;\n")

    # Actions (only those that appear in the data)
    used_actions = OrderedDict((a, None) for (_, _, a) in triples)
    out.append("INSERT INTO actions (slug, name, plane, axis, description, opposite_slug) VALUES")
    avals = []
    for aname in used_actions:
        plane, axis, opp, desc = ACTIONS[aname]
        opp_slug = slugify(opp) if opp else None
        avals.append("  (%s, %s, %s, %s, %s, %s)" % (
            q(slugify(aname)), q(aname), q(plane), q(axis), q(desc), q(opp_slug)))
    out.append(",\n".join(avals) + "\nON CONFLICT (slug) DO NOTHING;\n")

    # Muscles
    out.append("INSERT INTO muscles (slug, name, subdivision, display_name, muscle_group, "
               "origin, insertion, depth, innervation, blood_supply, description) VALUES")
    mvals = []
    for m in muscles.values():
        mvals.append("  (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)" % (
            q(m["slug"]), q(m["name"]), q(m["subdivision"]), q(m["display_name"]),
            q(m["group"]), q(m["origin"]), q(m["insertion"]), q(m["depth"]),
            q(m["innervation"]), q(m["blood"]), q(m["description"])))
    out.append(",\n".join(mvals) + "\nON CONFLICT (slug) DO NOTHING;\n")

    # Muscle-actions (dedupe triples)
    seen = set()
    out.append("INSERT INTO muscle_actions (muscle_id, joint_id, action_id, is_prime_mover)")
    out.append("SELECT m.id, j.id, a.id, v.is_prime_mover FROM (VALUES")
    mavals = []
    for lab, joint, action in triples:
        key = (lab, joint, action)
        if key in seen:
            continue
        seen.add(key)
        is_prime = PRIME_MOVERS.get((joint, action)) == lab
        mavals.append("  (%s, %s, %s, %s)" % (
            q(muscles[lab]["slug"]), q(slugify(joint)), q(slugify(action)),
            "TRUE" if is_prime else "FALSE"))
    out.append(",\n".join(mavals))
    out.append(") AS v(muscle_slug, joint_slug, action_slug, is_prime_mover)")
    out.append("JOIN muscles m ON m.slug = v.muscle_slug")
    out.append("JOIN joints  j ON j.slug = v.joint_slug")
    out.append("JOIN actions a ON a.slug = v.action_slug")
    out.append("ON CONFLICT (muscle_id, joint_id, action_id) DO NOTHING;\n")

    # Validate every prime mover actually matched a triple
    matched_primes = {(j, a) for (lab, j, a) in seen if PRIME_MOVERS.get((j, a)) == lab}
    missing = set(PRIME_MOVERS) - matched_primes
    if missing:
        raise SystemExit("Prime movers not matched to any muscle-action row: %s" % sorted(missing))

    # Fixators
    fvals = []
    for joint, (groups, note) in FIXATORS.items():
        for lab, m in muscles.items():
            if m["group"] in groups:
                fvals.append("  (%s, %s, %s)" % (q(slugify(joint)), q(m["slug"]), q(note)))
    out.append("INSERT INTO joint_fixators (joint_id, muscle_id, note)")
    out.append("SELECT j.id, m.id, v.note FROM (VALUES")
    out.append(",\n".join(fvals))
    out.append(") AS v(joint_slug, muscle_slug, note)")
    out.append("JOIN joints  j ON j.slug = v.joint_slug")
    out.append("JOIN muscles m ON m.slug = v.muscle_slug")
    out.append("ON CONFLICT (joint_id, muscle_id) DO NOTHING;")

    with open(OUT, "w") as f:
        f.write("\n".join(out) + "\n")
    print("Wrote", OUT)
    print("joints=%d actions=%d muscles=%d muscle_actions=%d fixators=%d" % (
        len(JOINTS), len(used_actions), len(muscles), len(seen), len(fvals)))


if __name__ == "__main__":
    main()
