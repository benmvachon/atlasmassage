import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { businessService } from '../services/businessService';
import ServiceAreaMap from '../components/ServiceAreaMap';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(t) {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function telHref(phone) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  return `tel:+${digits.length === 10 ? '1' : ''}${digits}`;
}

function sameHours(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.is_closed === b.is_closed && a.open_time === b.open_time && a.close_time === b.close_time;
}

function groupHours(rows) {
  const byDay = Object.fromEntries(rows.map(r => [r.day_of_week, r]));
  const days = Array.from({ length: 7 }, (_, i) => ({ day: i, name: DAY_NAMES[i], data: byDay[i] ?? null }));

  const groups = [];
  let i = 0;
  while (i < 7) {
    let j = i + 1;
    while (j < 7 && sameHours(days[i].data, days[j].data)) j++;
    groups.push({
      key: days[i].name,
      label: i === j - 1 ? days[i].name : `${days[i].name} – ${days[j - 1].name}`,
      data: days[i].data,
    });
    i = j;
  }
  return groups;
}

export default function HomePage() {
  const { data, loading } = useAsync(() => businessService.getHours());
  const hours = data?.data ?? [];

  const { data: contactData, loading: loadingContact } = useAsync(() => businessService.getContactInfo());
  const contact = contactData?.data ?? null;

  const { data: travelData } = useAsync(() => businessService.getTravelSettings());
  const travelModeEnabled = travelData?.data?.travel_mode_enabled ?? false;

  const { data: serviceAreaData } = useAsync(() => businessService.getServiceArea());
  const serviceAreaTowns = serviceAreaData?.data?.towns ?? [];
  const maxDriveMinutes = serviceAreaData?.data?.maxDriveMinutes ?? travelData?.data?.max_drive_minutes ?? 20;

  const mapQuery = contact
    ? encodeURIComponent(`${contact.address_line1}, ${contact.city}, ${contact.state} ${contact.zip}`)
    : encodeURIComponent('Boston, Massachusetts');

  return (
    <>
      <section className="hero">
        <div className="hero__inner">
          <p className="memberships-hero__eyebrow">Welcome to Atlas</p>
          <h1 className="hero__title">Therapeutic Bodywork</h1>
          <p className="hero__subtitle">
            Whether you&rsquo;re recovering from training, managing chronic pain, or simply
            aching from the ever-growing burden of modern life, our licensed therapists deliver
            personalized, evidence-informed care to give you lasting health and relief.
          </p>
          <Link to="/booking" className="btn btn--primary hero__cta">Book Now</Link>
        </div>
      </section>

      <div className="page">
        <section className="location-section">
          <div className="location-section__map">
            {travelModeEnabled && contact ? (
              <ServiceAreaMap contact={contact} maxDriveMinutes={maxDriveMinutes} />
            ) : (
              <iframe
                title="Atlas Bodywork location"
                src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                width="100%"
                height="420"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </div>

          <div className="location-section__details">
            <div className="biz-info">
              <h2 className="biz-info__heading">Hours</h2>
              {loading ? (
                <p className="biz-info__muted">Loading hours&hellip;</p>
              ) : hours.length === 0 ? (
                <p className="biz-info__muted">Please call or email us for current hours.</p>
              ) : (
                <ul className="biz-hours">
                  {groupHours(hours).map(({ key, label, data }) => (
                    <li key={key} className="biz-hours__row">
                      <span className="biz-hours__days">{label}</span>
                      <span className="biz-hours__time">
                        {!data || data.is_closed
                          ? 'Closed'
                          : `${formatTime(data.open_time)} – ${formatTime(data.close_time)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="biz-info">
              <h2 className="biz-info__heading">Contact</h2>
              {loadingContact ? (
                <p className="biz-info__muted">Loading contact info&hellip;</p>
              ) : !contact ? (
                <p className="biz-info__muted">Contact info is not available right now.</p>
              ) : (
                <ul className="biz-contact">
                  {travelModeEnabled ? (
                    <li className="biz-contact__item">
                      <span className="biz-contact__label">Areas</span>
                      <div className="biz-service-area">
                        <p className="biz-service-area__message">
                          We come to you at your home, your office, your gym, wherever and bring all our supplies
                          {serviceAreaTowns.length > 0 ? ', serving:' : '.'}
                        </p>
                        {serviceAreaTowns.length > 0 && (
                          <ul className="biz-service-area__towns">
                            {serviceAreaTowns.map(town => (
                              <li key={town} className="biz-service-area__town">{town}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  ) : (
                    <li className="biz-contact__item">
                      <span className="biz-contact__label">Address</span>
                      <span>
                        {contact.address_line1}
                        {contact.address_line2 && <><br />{contact.address_line2}</>}
                        <br />
                        {contact.city}, {contact.state} {contact.zip}
                      </span>
                    </li>
                  )}
                  <li className="biz-contact__item">
                    <span className="biz-contact__label">Phone</span>
                    <a href={telHref(contact.phone)} className="biz-contact__link">{contact.phone}</a>
                  </li>
                  <li className="biz-contact__item">
                    <span className="biz-contact__label">Email</span>
                    <a href={`mailto:${contact.email}`} className="biz-contact__link">
                      {contact.email}
                    </a>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
