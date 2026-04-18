# Requirements Document

## Introduction

Hệ thống Minecraft Bot hiện tại gặp vấn đề về tính ổn định kết nối, với bot thường xuyên bị ngắt kết nối ngay sau khi vào server. Tài liệu này định nghĩa các yêu cầu để cải thiện tính ổn định kết nối, xử lý lỗi tốt hơn, và tích hợp Supabase một cách đáng tin cậy.

## Glossary

- **Bot_System**: Hệ thống bot Minecraft sử dụng mindcraft-core
- **Connection_Manager**: Module quản lý kết nối đến Minecraft server
- **Stability_Monitor**: Component theo dõi tình trạng kết nối và phát hiện vấn đề
- **Reconnection_Handler**: Module xử lý logic kết nối lại tự động
- **Port_Scanner**: Component tự động phát hiện port LAN của Minecraft
- **Configuration_Manager**: Module quản lý cấu hình bot và server
- **Supabase_Sync**: Service đồng bộ dữ liệu với Supabase
- **Error_Handler**: Module xử lý và phân loại các loại lỗi kết nối

## Requirements

### Requirement 1: Connection Stability Management

**User Story:** Là một người dùng, tôi muốn bot có thể duy trì kết nối ổn định với Minecraft server, để bot không bị ngắt kết nối liên tục.

#### Acceptance Criteria

1. WHEN Bot_System kết nối đến Minecraft server, THE Connection_Manager SHALL duy trì kết nối trong ít nhất 5 phút liên tục
2. WHEN kết nối bị ngắt do lỗi mạng, THE Reconnection_Handler SHALL thử kết nối lại trong vòng 10 giây
3. THE Stability_Monitor SHALL theo dõi chất lượng kết nối và ghi log các sự kiện ngắt kết nối
4. WHEN ping time vượt quá 1000ms, THE Connection_Manager SHALL cảnh báo về độ trễ cao
5. THE Connection_Manager SHALL sử dụng keep-alive packets để duy trì kết nối

### Requirement 2: Automatic Port Detection

**User Story:** Là một người dùng, tôi muốn bot tự động phát hiện port LAN của Minecraft server, để không phải cấu hình thủ công khi port thay đổi.

#### Acceptance Criteria

1. WHEN Minecraft server mở LAN với port mới, THE Port_Scanner SHALL phát hiện port trong vòng 30 giây
2. THE Port_Scanner SHALL quét các port từ 25565 đến 65535 để tìm Minecraft server
3. WHEN tìm thấy port mới, THE Configuration_Manager SHALL cập nhật cấu hình tự động
4. THE Port_Scanner SHALL lưu lại port cuối cùng được sử dụng để ưu tiên quét
5. WHEN không tìm thấy port nào, THE Port_Scanner SHALL thông báo lỗi rõ ràng

### Requirement 3: Version Compatibility Handling

**User Story:** Là một người dùng, tôi muốn bot tự động xử lý vấn đề tương thích phiên bản, để bot có thể kết nối với Minecraft 1.20.1.

#### Acceptance Criteria

1. THE Bot_System SHALL hỗ trợ Minecraft version 1.20.1
2. WHEN phát hiện version mismatch, THE Connection_Manager SHALL thử sử dụng protocol tương thích
3. THE Configuration_Manager SHALL cho phép cấu hình version cụ thể thay vì "auto"
4. WHEN kết nối thất bại do version, THE Error_Handler SHALL đưa ra hướng dẫn khắc phục
5. THE Bot_System SHALL kiểm tra version compatibility trước khi thử kết nối

### Requirement 4: Enhanced Error Handling and Recovery

**User Story:** Là một người dùng, tôi muốn bot xử lý lỗi một cách thông minh và phục hồi tự động, để giảm thiểu thời gian downtime.

#### Acceptance Criteria

1. WHEN gặp ECONNREFUSED error, THE Reconnection_Handler SHALL thử kết nối lại với exponential backoff
2. THE Error_Handler SHALL phân loại lỗi thành recoverable và non-recoverable
3. WHEN gặp lỗi recoverable, THE Reconnection_Handler SHALL thử tối đa 5 lần với delay tăng dần
4. THE Error_Handler SHALL ghi log chi tiết về nguyên nhân lỗi và hành động được thực hiện
5. WHEN gặp lỗi non-recoverable, THE Bot_System SHALL dừng và thông báo cho người dùng

### Requirement 5: Supabase Integration Stability

**User Story:** Là một người dùng, tôi muốn tích hợp Supabase hoạt động ổn định, để dữ liệu bot được đồng bộ đáng tin cậy.

#### Acceptance Criteria

1. THE Supabase_Sync SHALL kết nối đến Supabase với thông tin từ environment variables
2. WHEN Supabase connection thất bại, THE Supabase_Sync SHALL hoạt động ở chế độ offline
3. THE Supabase_Sync SHALL đồng bộ dữ liệu bot mỗi 30 giây khi có kết nối
4. WHEN có lỗi API từ Supabase, THE Supabase_Sync SHALL retry với exponential backoff
5. THE Supabase_Sync SHALL cache dữ liệu locally khi không có kết nối internet

### Requirement 6: Configuration Management Enhancement

**User Story:** Là một người dùng, tôi muốn quản lý cấu hình bot dễ dàng và linh hoạt, để có thể điều chỉnh các tham số kết nối.

#### Acceptance Criteria

1. THE Configuration_Manager SHALL đọc cấu hình từ .env file và settings.js
2. THE Configuration_Manager SHALL cho phép override cấu hình qua environment variables
3. WHEN cấu hình thay đổi, THE Configuration_Manager SHALL validate tính hợp lệ
4. THE Configuration_Manager SHALL lưu cấu hình backup trước khi áp dụng thay đổi
5. THE Configuration_Manager SHALL cung cấp default values cho tất cả tham số quan trọng

### Requirement 7: Connection Monitoring and Diagnostics

**User Story:** Là một người dùng, tôi muốn theo dõi tình trạng kết nối của bot, để có thể chẩn đoán và khắc phục vấn đề kịp thời.

#### Acceptance Criteria

1. THE Stability_Monitor SHALL thu thập metrics về connection uptime, latency, và packet loss
2. THE Stability_Monitor SHALL cung cấp dashboard hiển thị tình trạng kết nối real-time
3. WHEN connection quality xuống dưới threshold, THE Stability_Monitor SHALL gửi cảnh báo
4. THE Stability_Monitor SHALL lưu lịch sử kết nối để phân tích xu hướng
5. THE Stability_Monitor SHALL tích hợp với MindServer UI để hiển thị thông tin

### Requirement 8: Authentication and Security

**User Story:** Là một người dùng, tôi muốn bot xử lý authentication một cách an toàn, để tránh các vấn đề bảo mật và kết nối.

#### Acceptance Criteria

1. THE Bot_System SHALL hỗ trợ cả offline và Microsoft authentication modes
2. WHEN sử dụng Microsoft auth, THE Bot_System SHALL cache token và refresh khi cần
3. THE Bot_System SHALL validate username format trước khi thử kết nối
4. WHEN authentication thất bại, THE Error_Handler SHALL đưa ra hướng dẫn khắc phục cụ thể
5. THE Bot_System SHALL bảo vệ thông tin authentication trong memory và logs

### Requirement 9: Network Optimization

**User Story:** Là một người dùng, tôi muốn bot tối ưu hóa việc sử dụng mạng, để giảm thiểu lag và packet loss.

#### Acceptance Criteria

1. THE Connection_Manager SHALL điều chỉnh packet send rate dựa trên network conditions
2. THE Connection_Manager SHALL sử dụng compression khi có thể để giảm bandwidth
3. WHEN phát hiện high latency, THE Connection_Manager SHALL giảm frequency của non-critical operations
4. THE Connection_Manager SHALL implement proper timeout handling cho tất cả network operations
5. THE Connection_Manager SHALL prioritize critical packets (movement, chat) over non-critical ones

### Requirement 10: Graceful Shutdown and Cleanup

**User Story:** Là một người dùng, tôi muốn bot shutdown một cách graceful, để tránh corruption dữ liệu và connection leaks.

#### Acceptance Criteria

1. WHEN nhận signal shutdown, THE Bot_System SHALL đóng tất cả connections trong vòng 5 giây
2. THE Bot_System SHALL lưu trạng thái hiện tại trước khi shutdown
3. THE Bot_System SHALL cleanup tất cả resources (sockets, timers, file handles)
4. THE Supabase_Sync SHALL đồng bộ dữ liệu cuối cùng trước khi shutdown
5. THE Bot_System SHALL ghi log shutdown event với timestamp và reason