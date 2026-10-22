import { riskColor, riskName } from '../lib/risk.js';

const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// station: { station:{name}, ok, days:[{date,tMax,tMin,precip,humidity,windMax,fri,level}] }
export default function ForecastStrip({ station }) {
  if (!station) return null;
  if (!station.ok) {
    return <div className="banner warn">Không lấy được dự báo cho {station.station.name}. {station.error}</div>;
  }
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{station.station.name}</div>
      <div className="forecast-strip">
        {station.days.map((d) => {
          const dt = new Date(`${d.date}T00:00:00`);
          return (
            <div key={d.date} className={`forecast-day ${d.date === today ? 'today' : ''}`}>
              <div className="forecast-day__label">{WD[dt.getDay()]}</div>
              <div className="forecast-day__date">{d.date.slice(5)}</div>
              <div className="forecast-day__temp">{Math.round(d.tMax)}°</div>
              <div className="forecast-day__rain">mưa {d.precip?.toFixed(1)} mm · ẩm {Math.round(d.humidity)}%</div>
              <div className="forecast-day__risk" style={{ background: riskColor(d.level) }}>
                {riskName(d.level)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
