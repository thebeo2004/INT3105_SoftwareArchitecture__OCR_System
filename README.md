# Dự án Xử lý Ảnh OCR và Dịch Thuật (INT3105 - Software Architecture Project)

## 1. Mô tả Dự án

Dự án hướng tới xây dựng một hệ thống có khả năng tiếp nhận file ảnh, thực hiện Nhận dạng Ký tự Quang học (OCR) để trích xuất văn bản, dịch văn bản đó sang tiếng Việt, và cuối cùng tạo ra một file PDF chứa văn bản đã dịch. Hệ thống được thiết kế với kiến trúc microservices, sử dụng Kafka để xử lý bất đồng bộ và Redis cho việc caching, cùng với bộ công cụ giám sát Prometheus và Grafana.

## 2. Các Nhiệm Vụ Đã Hoàn Thành

*   **Tiếp nhận File:**
    *   Xây dựng API endpoint (`/upload`) để người dùng có thể tải lên một hoặc nhiều file ảnh.
    *   Lưu trữ file tạm thời trên server.
*   **Pipeline Xử lý Bất đồng bộ với Kafka:**
    *   Triển khai Kafka làm message broker.
    *   Service `app` (producer) gửi thông tin file cần xử lý vào một topic Kafka.
    *   Service `worker` (consumer) lắng nghe topic Kafka để nhận và xử lý file.
*   **Xử lý Ảnh và Văn bản (Worker Service):**
    *   **OCR:** Tích hợp thư viện OCR (ví dụ: Tesseract.js) để trích xuất văn bản từ ảnh.
    *   **Dịch thuật:** Tích hợp API hoặc thư viện dịch thuật (ví dụ: Google Translate API) để dịch văn bản đã OCR.
    *   **Tạo PDF:** Tạo file PDF từ văn bản đã được dịch.
*   **Caching với Redis:**
    *   Triển khai Redis để cache kết quả xử lý (văn bản OCR và văn bản dịch) dựa trên hash của nội dung file.
    *   Giảm thiểu việc xử lý lặp lại cho các file giống hệt nhau, cải thiện hiệu năng.
*   **Giám sát Hệ thống (Monitoring):**
    *   Tích hợp Prometheus để thu thập metrics từ các service (`app` và `worker`).
    *   Các metrics chính được theo dõi:
        *   Số lượng file được xử lý.
        *   Thời gian xử lý của từng giai đoạn (OCR, Dịch thuật, Tạo PDF).
        *   Tổng thời gian xử lý.
        *   Tỷ lệ Cache Hit/Miss.
        *   Tỷ lệ lỗi xử lý.
        *   Sử dụng tài nguyên (CPU, Memory) của các service.
    *   Xây dựng Dashboard Grafana (`ocr-app-dashboard.json`) để trực quan hóa các metrics thu thập được.
*   **Kiểm thử Tải (Load Testing):**
    *   Xây dựng kịch bản kiểm thử tải bằng Grafana K6 (`test/load-test.js`) để đánh giá hiệu năng và khả năng chịu tải của hệ thống (Bao gồm 4 kịch bản kiểm thử: Kiểm thử cơ bản, Kiểm thử tải tăng dần, Kiểm thử sức tải (Stress test), Kiểm thử ngâm)
*   **Containerization với Docker:**
    *   Docker hóa các thành phần của hệ thống (Kafka, Zookeeper, Control Center, Redis, Prometheus, Grafana, và ứng dụng Node.js `worker`).
    *   Sử dụng Docker Compose (`docker-compose.yml`) để quản lý và khởi chạy toàn bộ hệ thống một cách dễ dàng.
*   **Tối ưu hóa (Đang thực hiện):**
    *   Phân tích và tìm cách tối ưu số lượng "filter" (worker instances) để phù hợp với hạ tầng phần cứng.

## 2.1. Quá Trình Phát Triển Kiến Trúc và Các Phiên Bản

Dự án được phát triển qua nhiều giai đoạn, với mỗi giai đoạn tập trung vào việc cải tiến và hoàn thiện kiến trúc hệ thống. Quá trình này được ghi nhận qua các nhánh (branch) riêng biệt trong repository, mỗi nhánh đại diện cho một bước tiến trong thiết kế và triển khai:

*   **Nhánh `basic_architecture` (Kiến trúc Nền tảng):**
    *   Đây là phiên bản khởi đầu của dự án, hiện thực hóa ý tưởng cốt lõi với một kiến trúc đồng bộ. Quy trình xử lý ảnh bao gồm OCR, dịch thuật và tạo PDF được thực thi tuần tự và trực tiếp ngay sau khi người dùng gọi API `/upload`.
    *   Điểm nổi bật của nhánh này là việc tích hợp một giao diện người dùng đơn giản, cho phép tương tác trực quan với hệ thống.
    *   Mặc dù đáp ứng được yêu cầu chức năng cơ bản, kiến trúc này bộc lộ những hạn chế về khả năng mở rộng và hiệu năng khi xử lý số lượng lớn yêu cầu đồng thời, do tính chất blocking của việc xử lý trực tiếp tại API.

*   **Nhánh `message_queue` (Tích hợp Hàng đợi Tin nhắn):**
    *   Để giải quyết những thách thức của kiến trúc nền tảng, nhánh này giới thiệu một sự thay đổi kiến trúc quan trọng: áp dụng mô hình Message Broker với Apache Kafka.
    *   Công việc xử lý ảnh (OCR, dịch thuật, PDF) được tách rời hoàn toàn khỏi luồng xử lý chính của API `/upload`. Thay vào đó, `App Service` chỉ đóng vai trò tiếp nhận yêu cầu và gửi thông điệp chứa thông tin file cần xử lý vào một hàng đợi Kafka.
    *   Một `Worker Service` độc lập (hoặc nhiều instances) sẽ lắng nghe hàng đợi này, nhận các thông điệp và thực hiện các tác vụ xử lý nặng một cách bất đồng bộ.
    *   Kiến trúc này mang lại lợi ích vượt trội về khả năng chịu lỗi, khả năng mở rộng (bằng cách tăng số lượng worker), và cải thiện đáng kể thời gian phản hồi của API `/upload` do không còn phải chờ đợi các tác vụ tốn thời gian.

*   **Nhánh `cache` (Tối ưu hóa với Caching):**
    *   Xây dựng trên nền tảng kiến trúc `message_queue`, nhánh `cache` tập trung vào việc tối ưu hóa hiệu năng hơn nữa bằng cách triển khai cơ chế caching với Redis.
    *   Trước khi thực hiện các tác vụ OCR và dịch thuật tốn kém, `Worker Service` sẽ kiểm tra xem nội dung file (dựa trên mã hash của file) đã từng được xử lý và lưu trữ trong Redis hay chưa.
    *   Nếu tìm thấy trong cache (cache hit), kết quả sẽ được sử dụng lại ngay lập tức, bỏ qua các bước xử lý nặng. Điều này giúp giảm thiểu đáng kể thời gian xử lý cho các file trùng lặp và giảm tải cho hệ thống.

**Giám sát và So sánh Hiệu năng:**
Một khía cạnh quan trọng trong quá trình phát triển là việc triển khai cơ chế giám sát (sử dụng Prometheus và Grafana) cho cả ba phiên bản kiến trúc. Điều này cho phép nhóm thực hiện các kịch bản kiểm thử tải (load testing) một cách nhất quán và thu thập dữ liệu hiệu năng chi tiết. Từ đó, nhóm có thể đưa ra những so sánh tường minh về ưu nhược điểm của từng kiến trúc, đánh giá hiệu quả của các giải pháp cải tiến và đưa ra quyết định dựa trên dữ liệu thực tế.

## 3. Kiến trúc Triển Khai Hiện Tại (Message Queue, Cache)

Phần dưới đây mô tả chi tiết kiến trúc hệ thống đã được hoàn thiện và tối ưu nhất, tương ứng với sự kết hợp của các ý tưởng từ nhánh `message_queue` và `cache`. Sơ đồ và luồng hoạt động thể hiện cách các thành phần tương tác trong một môi trường được quản lý bởi Docker Compose, tận dụng Kafka cho xử lý bất đồng bộ và Redis cho caching.

![Sơ đồ kiến trúc hệ thống](system_architecture.jpg "Sơ đồ Kiến trúc Hệ thống")

**Luồng hoạt động chính:**

1.  **Upload:** Người dùng tải file ảnh lên `App Service`.
2.  **Queueing:** `App Service` lưu file vào một thư mục chia sẻ (ví dụ: `uploads/`) và gửi một message chứa tên file (hoặc đường dẫn) vào topic `received_files` trên Kafka.
3.  **Processing:** `Worker Service` (một hoặc nhiều instance) consume message từ Kafka.
4.  **Cache Check:** Worker kiểm tra Redis cache xem file này (dựa trên hash nội dung) đã được xử lý trước đó chưa.
    *   **Cache Hit:** Nếu có, lấy kết quả từ cache.
    *   **Cache Miss:** Nếu không, worker đọc file từ thư mục `uploads/`.
5.  **Core Logic (nếu Cache Miss):**
    *   Thực hiện OCR để trích xuất văn bản.
    *   Dịch văn bản sang ngôn ngữ đích.
    *   Lưu kết quả (văn bản OCR, văn bản dịch) vào Redis cache.
6.  **Output:** Tạo file PDF từ văn bản đã dịch. (Việc lưu trữ/trả về file PDF này cho người dùng cần được làm rõ thêm trong yêu cầu).
7.  **Monitoring:** Tất cả các service (`app`, `worker`, Kafka, Redis) đều expose metrics cho Prometheus. Grafana sử dụng Prometheus làm datasource để hiển thị dashboard.

## 4. Cách Sử Dụng

### 4.1. Yêu Cầu Hệ Thống

*   Docker
*   Docker Compose
*   Node.js và npm
*   Grafana k6 (Thực thi các kịch bản kiểm thử)

### 4.2. Khởi Chạy Hệ Thống

0. **Cài đặt các gói liên quan và tạo folder:**
    ```bash
    npm install
    mkdir uploads
    mkdir output
    ```

1.  **Xây dựng và khởi chạy các container Docker:**
    ```bash
    docker-compose up --build 
    ```
    Lệnh này sẽ xây dựng image cho `worker` và khởi chạy tất cả các service.

2.  **Kiểm tra trạng thái các container:**
    ```bash
    docker-compose ps
    ```
    Đảm bảo tất cả các service nên ở trạng thái `Up` hoặc `running`.

3.  **Tiếp tục khởi chạy Server (app.js):**
    ```bash
    npm start dev
    ```
    Lưu ý, Server chỉ có thể thực thi một cách trơn tru khi khởi tạo **Broker** ở docker-compose thành công.

### 4.3. Sử Dụng Chức Năng Upload

*   **Endpoint:** `POST http://localhost:5000/upload`
*   **Body:** `multipart/form-data`
*   **Field:** `files` (có thể upload một hoặc nhiều file)
*   **Ví dụ sử dụng `curl`:**
    ```bash
    curl -X POST -F "files=@/path/to/your/image1.jpg" -F "files=@/path/to/your/image2.png" http://localhost:5000/upload
    ```
*  Hoặc trực tiếp sử dụng ứng dụng **Postman**.   
    Sau khi upload, bạn có thể kiểm tra logs của `app` và `worker` để xem quá trình xử lý, với log của `app` xem ở Terminal.
    ```bash
    docker-compose logs -f worker
    ```
* Files ban đầu sẽ được tải lên Server ở thư mục `/uploads`, còn nội dung PDF sau đó sẽ được đẩy ra ở `/output`

### 4.4. Truy Cập Các Công Cụ Giám Sát

*   **Prometheus UI:** `http://localhost:9090`
    *   Có thể xem các target (Status -> Targets) và thực thi các truy vấn PromQL.
*   **Grafana UI:** `http://localhost:3000`
    *   Dashboard "OCR App Dashboard" sẽ được tự động provision do cấu hình trong `grafana/provisioning/dashboards/`.
*   **Confluent Control Center:** `http://localhost:9021`

### 4.5. Chạy Kiểm Thử Tải (k6)

1.  Đảm bảo hệ thống đang chạy (các service Docker Compose đã `up` và cả `NodeJS` server).
2.  Mở terminal mới, điều hướng đến thư mục gốc của dự án.
3.  Chạy lệnh:
    ```bash
    k6 run test/load-test.js
    ```
    Kết quả kiểm thử sẽ được hiển thị trên terminal. Bạn cũng có thể theo dõi các dashboard Grafana trong quá trình chạy tải để xem hệ thống phản ứng như thế nào.

### 4.6. Dừng Hệ Thống

```bash
docker-compose down
```
Nếu bạn muốn xóa cả volumes (dữ liệu Kafka, Grafana, v.v.):
```bash
docker-compose down -v
```

## 5. Thành Viên Nhóm

*   [Nguyễn Hữu Thế - 22028155](https://github.com/thebeo2004)
*   [Vũ Thị Minh Thư - 22028116](https://github.com/VuThiMinhThu2004)
*   [Nguyễn Hữu Tiến - 22028180](https://github.com/tien1712)
