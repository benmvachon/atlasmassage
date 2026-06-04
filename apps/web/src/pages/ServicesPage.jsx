import bodyMapPNG from '../assets/body-map.png';

const LEFT_SERVICES = [
  {
    name: 'Hot Stone Application',
    description:
      "Heated basalt stones are placed and worked across the body, driving warmth into deep muscle tissue and settling the nervous system.",
  },
  {
    name: 'Deep Tissue & Myofascial Work',
    description:
      'Slow, sustained pressure reaches the deeper layers of muscle and connective tissue, releasing chronic tension and restrictions.',
  },
];

const RIGHT_SERVICES = [
  {
    name: 'Cupping',
    description:
      'Suction cups lift soft tissue to encourage fluid movement, relieving adhesions and decompressing overworked muscles.',
  },
  {
    name: 'Assisted Stretching',
    description:
      'Your therapist guides each stretch to the end of your comfortable range, improving mobility.',
  },
  {
    name: 'Trigger Point Therapy',
    description:
      'Concentrated pressure on hyperirritable muscle spots interrupts the pain-spasm cycle at its source, to resolve referred pain patterns.',
  },
];

function ServiceBlurb({ name, description }) {
  return (
    <div className="service-blurb">
      <h3 className="service-blurb__name">{name}</h3>
      <p className="service-blurb__description">{description}</p>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <div className="page page--services">
      <div className="services__intro">
        <h1 className="services__heading">Our Services</h1>
        <p className="services__tagline">
          All our services are available to every client <strong>at no additional cost</strong>.
        </p>
        <p className="services__tagline">
          Your therapist draws on whichever combination of modalities will be most
          effective for you, adjusting in real time as the session unfolds.
        </p>
        <p className="services__tagline">
        If there is a bodywork service that you feel would be helpful but don&rsquo;t see
        listed on this page, <strong>talk to your therapist</strong> and we will do our best to
        accomodate your needs.
      </p>
      </div>

      <div className="services__graphic">
        <div className="services__col services__col--left">
          {LEFT_SERVICES.map((s) => (
            <ServiceBlurb key={s.name} {...s} />
          ))}
        </div>

        <div className="services__body-map">
          <img src={bodyMapPNG} alt="Diagram of the body showing treatment areas" />
        </div>

        <div className="services__col services__col--right">
          {RIGHT_SERVICES.map((s) => (
            <ServiceBlurb key={s.name} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
}
