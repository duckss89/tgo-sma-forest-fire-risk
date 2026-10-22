// rows: analysis.weightsTable
export default function WeightsTable({ rows }) {
  if (!rows?.length) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl" style={{ minWidth: 440 }}>
        <thead>
          <tr>
            <th>Biến</th>
            <th>Trọng số</th>
            <th>Độ lớn</th>
            <th>Ràng buộc</th>
            <th>Ảnh hưởng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.feature}>
              <td><b>{r.label}</b></td>
              <td className="mono">{r.weight > 0 ? '+' : ''}{r.weight.toFixed(4)}</td>
              <td>
                <span className="w-bar-track"><span className="w-bar-fill" style={{ width: `${Math.round(r.bar * 100)}%` }} /></span>
              </td>
              <td className="mono muted">[{r.constraint[0]}, {r.constraint[1]}]</td>
              <td>
                <span className={`dir ${r.direction}`}>
                  {r.direction === 'up' ? '▲' : '▼'} {r.meaning}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
