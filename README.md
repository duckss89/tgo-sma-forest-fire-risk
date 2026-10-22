# FRI Lâm Đồng — Website thuật toán lai ghép TGO-SMA

Website hoàn chỉnh cho đề tài **"Ứng dụng thuật toán lai ghép TGO-SMA tối ưu hóa trọng số
đánh giá nguy cơ cháy rừng tỉnh Lâm Đồng"**.

- **Backend** (`server/`): Node.js + Express. Port nguyên vẹn lớp `TGO_SMA_Hybrid_Scientific`
  từ `Code/03_scripts/metaheuristic_comparison_v8.py` sang JavaScript làm **lõi tính toán**.
- **Bản đồ FRI**: tính lại từ 5 ảnh chỉ số Landsat thật với trọng số của mỗi lần chạy
  (`server/src/data/friRaster.js`), phủ Leaflet dạng một lớp ảnh georeferenced.
- **Frontend** (`client/`): React + Vite. Bản đồ Leaflet + marker cluster, biểu đồ SVG tự vẽ,
  giao diện theo `design/ui-mockup.html`.

---

## 1. Yêu cầu

- **Node.js ≥ 18.17** (khuyến nghị 20 LTS) — tải tại <https://nodejs.org>.
  Kiểm tra: `node -v`.
- Kết nối Internet (tile bản đồ OpenStreetMap + dự báo Open-Meteo). Thuật toán và dữ liệu
  huấn luyện chạy hoàn toàn offline.

## 2. Cài đặt

```bash
cd web
npm run install:all          # cài cho cả server/ và client/
```

Cấu hình tùy chọn (khóa NASA FIRMS thời gian thực):

```bash
cd server
copy .env.example .env        # Windows   (macOS/Linux: cp .env.example .env)
# sửa .env, điền FIRMS_MAP_KEY nếu có
```

## 3. Chạy (chế độ phát triển — 2 cửa sổ terminal)

```bash
# Terminal 1 — API
cd web
npm run dev:server            # http://localhost:4000

# Terminal 2 — giao diện
cd web
npm run dev:client            # http://localhost:5173  (mở trình duyệt ở đây)
```

Vite tự chuyển tiếp `/api/*` sang cổng 4000.

## 4. Chạy (chế độ 1 máy chủ — bản build)

```bash
cd web
npm run build                 # build client -> client/dist
npm start                     # http://localhost:4000  (phục vụ cả giao diện + API)
```

---

## 5. Luồng sử dụng

1. **Nhập dữ liệu** — hệ thống đã tích hợp `training_data_ffrm.csv` (11.604 điểm), điểm cháy
   FIRMS và ranh giới Lâm Đồng. Có thể nạp thêm CSV điểm cháy / khí tượng.
2. **Cấu hình & chạy** — đặt `pop`, `iter`, số lần chạy, seed → nhấn *Bắt đầu*. Lõi TGO-SMA
   chạy trên máy chủ, tiến trình cập nhật realtime qua Server-Sent Events.
3. **Kết quả** — bản đồ FRI (cập nhật theo trọng số vừa tối ưu), đường cong hội tụ, ma trận
   nhầm lẫn + ROC, bảng trọng số, phân tích độ nhạy, so sánh với baseline của đề tài,
   kiểm chứng FIRMS theo năm, dự báo nguy cơ 7 ngày. Xuất CSV / in PDF.
4. **Lịch sử** — lưu và đối chiếu các lần chạy.

---

## 6. Lõi thuật toán (`server/src/core/`)

| Tệp | Vai trò |
|---|---|
| `tgoSma.js` | **TGO-SMA Hybrid** — pha TGO + pha SMA mỗi vòng, kho tinh hoa, Lévy, tìm kiếm cục bộ, khởi động lại khi trì trệ, tinh chỉnh cuối |
| `constraints.js` | 8 biến + ràng buộc khoa học cho dấu trọng số |
| `fitness.js` | `fitness = AUC × (0,5 + 0,5·F1) × diversity` |
| `metrics.js` | AUC (Mann–Whitney), F1, ROC, kiểm định Mann–Whitney U |
| `eliteArchive.js`, `levy.js`, `localSearch.js` | thành phần phụ trợ của bản hybrid |
| `analysis.js` | đánh giá test, bảng trọng số, tornado, validation theo năm (tra mức tại điểm cháy trên raster FRI) |
| `forecastRisk.js` | chỉ số thời tiết cháy rừng 7 ngày (rule-based, không phải FRI) |
| `../data/friRaster.js` | tính raster FRI từ 5 băng Landsat + trọng số lần chạy; `../scripts/build-fri-bands.mjs` tiền xử lý ảnh gốc |

## 7. API chính

| Method | Đường dẫn | Mô tả |
|---|---|---|
| `POST` | `/api/optimize` | tạo phiên chạy TGO-SMA |
| `GET` | `/api/optimize/:id/stream` | SSE tiến trình realtime |
| `GET` | `/api/map/fri?jobId=` | raster FRI (base64) theo bộ trọng số của lần chạy |
| `GET` | `/api/map/boundary` · `/api/map/fires` | ranh giới · 2.887 điểm cháy nghiên cứu |
| `GET` | `/api/reference` | số liệu so sánh tĩnh từ đề tài gốc |
| `GET` | `/api/weather/forecast?jobId=` | dự báo 7 ngày + mức nguy cơ |
| `GET/POST/DELETE` | `/api/history` | lịch sử các lần chạy |

---

## 8. Bản đồ FRI — độ trung thực dữ liệu

Bản đồ nguy cơ trên trang Kết quả **được tính thật** theo đúng phương pháp Chương 3–4:

- Lấy 5 ảnh chỉ số Landsat 2024 đã tính ở Chương 3 (**NDVI, NBR, NDWI, NBRT, LST**),
  chuẩn hóa p2–p98 (`normalize_raster`), chiếu về lưới kinh/vĩ độ 820×631 phủ tỉnh Lâm Đồng.
  Bước này do `scripts/build-fri-bands.mjs` làm sẵn, kết quả đóng gói ở
  `server/data/fri_bands_2024.json.gz` (259.833 ô hợp lệ).
- Mỗi lần chạy: `FRI(pixel) = Σ wᵢ · bandᵢ(pixel)` với **wᵢ là trọng số TGO-SMA vừa tối ưu**
  (trọng số T2M gán cho băng LST — đúng chú thích "Thay T2M" trong `create_fri_map_v2.py`),
  rồi chuẩn hóa p1–p99 → [0,1] → phân 5 mức 0,2/0,4/0,6/0,8.
- **Không có số ngẫu nhiên nào** trên từng điểm. Đã kiểm chứng: tái dựng với trọng số đề tài
  cho MAE ≈ 0,0003 so với `FRI_2024.tif`, tỷ lệ Cao+Rất cao ≈ 39–40% (báo cáo mục 4.3: 38%).
- 3 biến khí tượng (RH2M, WS2M, PRECTOTCORR) **không đổi hình bản đồ**: trong pipeline gốc
  chúng lấy trung bình 3 trạm nên gần như hằng số theo không gian — chỉ là một offset bị loại
  khi chuẩn hóa p1–p99. Chúng vẫn ảnh hưởng tới **mô hình** (AUC, kiểm chứng FIRMS).
- Thang màu Leaflet **cố định 0–1** (không co giãn theo min/max từng lần chạy) — khớp thanh
  chú giải bên phải. Hiển thị: làm mượt nhẹ (trung bình 3×3) + nội suy song tuyến + cắt theo
  ranh giới tỉnh; số liệu phân loại tính trên FRI thô (không mượt).
- Điểm cháy: 2.887 điểm `fire=1` của tập huấn luyện (NASA FIRMS 2023–2025 đã lọc trong vùng),
  hiển thị dạng **cụm gộp** (marker cluster) với công tắc bật/tắt riêng.

### Đổi năm bản đồ / dựng lại lớp băng

```bash
cd web/server
npm run build:bands -- --indices "<đường dẫn>/Code/02_processed_data/indices" --year 2024
```
(cần `Code/02_processed_data/indices/2024/{NDVI,NBR,NDWI,NBRT,LST}_2024.tif`; file `.json.gz`
kết quả đã kèm sẵn cho 2024 nên bình thường **không cần chạy lại**).

## 9. Lưu ý khác

- Cấu hình mặc định theo báo cáo: **quần thể 50, 150 vòng lặp**. Kết quả không trùng khớp
  đề tài do bộ sinh ngẫu nhiên JavaScript ≠ NumPy và mặc định chạy 1 lần — tăng *số lần chạy*.
- Dòng đối chiếu ở trang Kết quả so với **AUC ≈ 0,8335** (kết quả TGO-SMA công bố, Bảng 4.1).
- Hàm fitness dùng tối đa 4.000 dòng huấn luyện (cân bằng lớp); đổi `maxFitnessRows` trong
  `server/src/data/dataset.js` để dùng toàn bộ.
- Ngưỡng phân loại và việc lật AUC (<0,5) giữ đúng pipeline gốc.
- Trang Upload chỉ hiển thị ranh giới tỉnh; bản đồ FRI xuất hiện ở trang Kết quả.
