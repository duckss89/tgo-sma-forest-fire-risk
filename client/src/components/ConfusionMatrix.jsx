import { fmt, fmtPct } from '../lib/risk.js';

// test: { confusion: {tp,fp,fn,tn}, accuracy, precision, recall, auc }
export default function ConfusionMatrix({ test }) {
  if (!test) return null;
  const { tp, fp, fn, tn } = test.confusion;
  return (
    <div>
      <div className="confmat">
        <div />
        <div className="confmat__colhead">Dự đoán: có cháy</div>
        <div className="confmat__colhead">Dự đoán: không cháy</div>

        <div className="confmat__rowhead">Thực tế:<br />có cháy</div>
        <div className="confmat__cell correct"><div className="num">{tp}</div><div className="lbl">Đúng (TP)</div></div>
        <div className="confmat__cell incorrect"><div className="num">{fn}</div><div className="lbl">Bỏ sót (FN)</div></div>

        <div className="confmat__rowhead">Thực tế:<br />không cháy</div>
        <div className="confmat__cell incorrect"><div className="num">{fp}</div><div className="lbl">Báo động giả (FP)</div></div>
        <div className="confmat__cell correct"><div className="num">{tn}</div><div className="lbl">Đúng (TN)</div></div>
      </div>

      <div className="stat-row" style={{ marginTop: 16 }}>
        <div className="stat"><div className="stat__label">Độ chính xác</div><div className="stat__value">{fmtPct(test.accuracy * 100)}</div></div>
        <div className="stat"><div className="stat__label">Precision</div><div className="stat__value">{fmt(test.precision, 3)}</div></div>
        <div className="stat"><div className="stat__label">Recall</div><div className="stat__value">{fmt(test.recall, 3)}</div></div>
        <div className="stat"><div className="stat__label">AUC</div><div className="stat__value">{fmt(test.auc, 3)}</div></div>
      </div>
    </div>
  );
}
