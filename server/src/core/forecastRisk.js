// Cảnh báo thời tiết cháy rừng cho 7 ngày tới.
//
// LƯU Ý: đây KHÔNG phải mô hình FRI (vốn cần chỉ số vệ tinh). Đây là chỉ số thời tiết
// minh bạch dựa trên nhiệt độ / độ ẩm / lượng mưa / gió — kiểu Fire Weather Index rút gọn —
// để hỗ trợ trực quan, không thay cho bản đồ FRI.

function levelFromScore(s) {
  if (s >= 7) return 5;
  if (s >= 5) return 4;
  if (s >= 3) return 3;
  if (s >= 1) return 2;
  return 1;
}

export function forecastRisk(_weights, days) {
  return days.map((day) => {
    const tAvg = (day.tMax + day.tMin) / 2;
    let s = 0;
    // nhiệt độ cao
    if (day.tMax >= 32) s += 2;
    else if (day.tMax >= 28) s += 1;
    // không khí khô
    if (day.humidity < 40) s += 3;
    else if (day.humidity < 55) s += 2;
    else if (day.humidity < 70) s += 1;
    // ít mưa (mm/ngày)
    if (day.precip < 1) s += 3;
    else if (day.precip < 3) s += 2;
    else if (day.precip < 6) s += 1;
    // gió mạnh (km/h)
    if (day.windMax >= 30) s += 2;
    else if (day.windMax >= 20) s += 1;

    return {
      date: day.date,
      tMax: day.tMax,
      tMin: day.tMin,
      tAvg: Number(tAvg.toFixed(1)),
      precip: day.precip,
      humidity: day.humidity,
      windMax: day.windMax,
      score: s,
      level: levelFromScore(s),
    };
  });
}
