# 本地 App 技术实现方案对比

## 1. 背景

如果产品从“网页工具”改为“本地 App”，核心约束会发生变化：

- 仍然可以完全本地处理照片
- 可以使用原生文件系统、原生 FFmpeg、GPU 和更成熟的图像处理库
- 性能、稳定性、导出质量通常优于纯网页
- 但用户需要下载安装，分发、更新、签名和跨平台适配成本更高

本地 App 更适合追求稳定导出、高质量视频、批量处理和更强隐私感的版本。

## 2. 本地 App 的通用处理架构

无论采用哪种客户端技术，核心模块大致一致：

1. UI 层：上传、预览、异常确认、参数设置、导出进度
2. 文件层：读取本地照片、EXIF、缓存中间结果
3. 识别层：人脸检测、眼睛关键点、多人检测
4. 对齐层：计算旋转、缩放、平移、裁剪和平滑参数
5. 渲染层：批量生成对齐后的帧
6. 编码层：调用 FFmpeg 或系统编码器生成 MP4/GIF
7. 项目层：保存本地项目、恢复编辑状态

## 3. 方案一：Electron + Node.js + 原生 FFmpeg + MediaPipe/ONNX

### 3.1 技术组成

- UI：React / Vue / Svelte
- 桌面壳：Electron
- 文件处理：Node.js
- EXIF：exiftool、exifr、sharp metadata
- 图像处理：sharp、opencv4nodejs、Canvas
- 人脸关键点：MediaPipe、ONNX Runtime、face-api.js、OpenCV 方案
- 视频导出：原生 FFmpeg

### 3.2 工作方式

Electron 负责桌面应用和 UI。Node.js 负责本地文件读取、缓存、调用 FFmpeg 和模型推理。前端仍然可以复用网页版的大部分交互逻辑。

### 3.3 优点

- 开发效率高
- 前端技术栈成熟，UI 迭代快
- 很容易复用网页版代码
- Node.js 调用本地 FFmpeg、文件系统、Worker 很方便
- 跨平台能力成熟，Windows/macOS/Linux 都能覆盖
- 适合快速做一个完整可发布的桌面版

### 3.4 缺点

- 安装包大，内存占用偏高
- Electron 自带 Chromium，轻量感不如 Tauri 或原生 App
- 原生依赖、模型文件、FFmpeg 打包需要仔细处理
- 应用签名、公证、自动更新仍有工程成本

### 3.5 适合情况

- 团队以前端/Node.js 为主
- 希望最快做出跨平台桌面版
- 希望最大化复用网页版 UI
- 可以接受安装包和运行内存较大

## 4. 方案二：Tauri + Web UI + Rust 后端 + 原生 FFmpeg

### 4.1 技术组成

- UI：React / Vue / Svelte
- 桌面壳：Tauri
- 后端：Rust
- 图像处理：image、imageproc、OpenCV Rust binding、libvips binding
- 人脸关键点：MediaPipe 侧车进程、ONNX Runtime、OpenCV
- 视频导出：原生 FFmpeg

### 4.2 工作方式

UI 使用 Web 技术，核心能力放在 Rust 后端。Rust 负责文件、缓存、任务调度、图像处理和调用 FFmpeg。

### 4.3 优点

- 安装包通常比 Electron 小
- 内存占用更低
- Rust 后端适合做高性能批处理
- 本地安全边界更好控制
- UI 仍可复用部分网页版代码
- 符合“本地、轻量、隐私”的产品气质

### 4.4 缺点

- 开发复杂度高于 Electron
- Rust 生态做人脸关键点不如 Python/JS 直接
- 接入 MediaPipe、ONNX、OpenCV 时工程门槛较高
- 系统 WebView 差异可能带来 UI 兼容性问题
- 团队需要同时掌握前端和 Rust

### 4.5 适合情况

- 希望产品显得更轻、更原生
- 团队有 Rust 能力
- 愿意为性能和包体投入更多工程成本
- 长期希望做一个高质量本地工具

## 5. 方案三：Python + Qt/PySide + OpenCV/MediaPipe + FFmpeg

### 5.1 技术组成

- UI：PySide6 / PyQt
- EXIF：Pillow、exifread、piexif
- 图像处理：OpenCV、Pillow、NumPy
- 人脸关键点：MediaPipe Python、OpenCV、dlib、InsightFace
- 视频导出：FFmpeg 或 OpenCV VideoWriter
- 打包：PyInstaller、Briefcase、Nuitka

### 5.2 工作方式

整个应用主要用 Python 编写。UI 使用 Qt，图像处理、模型推理和视频生成都在 Python 侧完成。

### 5.3 优点

- 算法开发效率非常高
- OpenCV、MediaPipe、NumPy、Pillow 生态成熟
- 很适合快速验证人脸对齐算法
- 调用 FFmpeg 简单
- 对技术原型和内部工具非常友好

### 5.4 缺点

- 打包和跨平台分发容易踩坑
- 安装包可能很大
- UI 质感通常不如 Web UI 或原生 UI
- Python 运行时、模型、OpenCV、FFmpeg 一起打包会比较重
- macOS 签名、公证和 Windows 杀毒误报需要处理

### 5.5 适合情况

- 先做算法验证版或内部测试版
- 团队熟悉 Python/CV
- 更重视处理能力而不是 UI 精致度
- 后续可能把算法核心迁移到其他客户端

## 6. 方案四：Flutter Desktop + 原生插件 + FFmpeg

### 6.1 技术组成

- UI：Flutter
- 业务逻辑：Dart
- 原生插件：Swift/Kotlin/C++/Rust
- 图像处理：OpenCV、原生图像库或 Rust/C++ 模块
- 人脸关键点：MediaPipe、ML Kit、ONNX Runtime、平台原生能力
- 视频导出：FFmpeg Kit、原生 FFmpeg 或平台编码器

### 6.2 工作方式

Flutter 负责跨平台 UI，重计算能力通过原生插件实现。适合未来同时覆盖桌面和移动端。

### 6.3 优点

- UI 体验好，跨平台一致性强
- 后续扩展到 iOS/Android 更自然
- 性能比 Electron UI 更可控
- 适合做消费者级应用

### 6.4 缺点

- 桌面端生态不如移动端成熟
- 人脸检测、FFmpeg、文件权限等需要较多插件适配
- 复杂原生插件开发成本高
- 复用网页版代码能力弱

### 6.5 适合情况

- 未来明确要做移动 App
- 团队熟悉 Flutter
- 希望 UI 精致、跨平台统一
- 愿意投入原生插件开发

## 7. 方案五：macOS 原生 App，Swift/SwiftUI + Vision + AVFoundation

### 7.1 技术组成

- UI：SwiftUI / AppKit
- EXIF：ImageIO
- 人脸和眼睛：Apple Vision
- 图像处理：Core Image / Metal
- 视频导出：AVFoundation

### 7.2 工作方式

完全使用 Apple 原生框架实现 macOS 版本。利用 Vision 进行人脸和关键点检测，Core Image/Metal 处理图像，AVFoundation 导出视频。

### 7.3 优点

- macOS 体验最好
- 性能优秀
- 安装包相对可控
- 系统框架稳定，无需额外打包大型模型
- 视频导出和硬件加速能力强
- 隐私叙事非常自然

### 7.4 缺点

- 只能覆盖 Apple 平台
- Windows 用户无法使用
- 后续跨平台成本高
- 需要原生 Apple 开发能力

### 7.5 适合情况

- 第一批用户主要是 Mac 用户
- 追求高质量体验
- 愿意先做单平台精品工具

## 8. 方案六：Windows 原生 App，.NET/WPF/WinUI + OpenCV/ONNX + FFmpeg

### 8.1 技术组成

- UI：WPF / WinUI 3
- 业务逻辑：C#
- 图像处理：OpenCVSharp、ImageSharp
- 人脸关键点：ONNX Runtime、OpenCV、MediaPipe 侧车进程
- 视频导出：FFmpeg 或 Media Foundation

### 8.2 优点

- Windows 原生体验好
- 文件系统、硬件编码、安装包能力成熟
- C# 做桌面应用效率较高
- 对 Windows 用户稳定

### 8.3 缺点

- 只能覆盖 Windows
- 需要另做 macOS 版本
- UI 和算法生态不如 Python 灵活
- 复用网页版代码较少

### 8.4 适合情况

- 目标用户主要是 Windows
- 团队熟悉 .NET
- 希望做一个 Windows 专用工具

## 9. 方案七：C++ / Qt + OpenCV + FFmpeg

### 9.1 技术组成

- UI：Qt Widgets / Qt Quick
- 图像处理：OpenCV
- 人脸关键点：MediaPipe C++、dlib、ONNX Runtime、OpenCV
- 视频导出：FFmpeg

### 9.2 优点

- 性能强
- 跨平台能力成熟
- 对图像处理和视频处理非常直接
- 可控性最高
- 适合做专业级工具

### 9.3 缺点

- 开发成本高
- UI 迭代慢
- 工程复杂度高
- 对小型免费工具来说可能过重

### 9.4 适合情况

- 需要长期做专业本地工具
- 团队有 C++/Qt 经验
- 对性能和稳定性要求极高

## 10. 核心模块技术建议

### 10.1 人脸关键点检测

推荐优先级：

1. MediaPipe Face Landmarker
2. Apple Vision，适用于 macOS/iOS 原生方案
3. ONNX Runtime + 人脸关键点模型
4. OpenCV/dlib，作为备选或原型

### 10.2 视频导出

推荐：

- 桌面跨平台：原生 FFmpeg
- macOS 原生：AVFoundation
- Windows 原生：FFmpeg 或 Media Foundation

桌面 App 不建议再优先使用 ffmpeg.wasm。原生 FFmpeg 的速度、稳定性、格式支持都更好。

### 10.3 图像处理

推荐：

- Python 原型：OpenCV + NumPy
- Electron：sharp + OpenCV/ONNX
- Tauri/Rust：image/imageproc + OpenCV/libvips binding
- macOS：Core Image / Metal
- C++：OpenCV

### 10.4 项目保存

本地 App 比网页更适合支持项目保存。

建议保存：

- 原照片路径或导入副本
- 每张照片的 EXIF 时间
- 人脸框和眼睛关键点
- 用户选择的目标人物
- 手动修正点位
- 排序
- 导出参数

## 11. 方案对比表

| 方案 | 开发效率 | 性能 | 包体 | 跨平台 | UI 体验 | 算法便利性 | 推荐阶段 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Electron + Node | 高 | 中 | 大 | 强 | 强 | 中 | 桌面 MVP |
| Tauri + Rust | 中 | 高 | 小 | 强 | 强 | 中低 | 长期本地版 |
| Python + Qt | 高 | 中高 | 大 | 中 | 中 | 很高 | 算法原型 |
| Flutter Desktop | 中 | 中高 | 中 | 强 | 强 | 中 | 桌面+移动路线 |
| macOS 原生 | 中 | 很高 | 小 | 弱 | 很强 | 中 | Mac 精品版 |
| Windows 原生 | 中 | 高 | 中 | 弱 | 强 | 中 | Windows 专用版 |
| C++/Qt | 低 | 很高 | 中 | 强 | 中 | 高 | 专业长期版 |

## 12. 推荐路线

### 12.1 如果你想最快做出本地 App MVP

推荐：

> Electron + React + Node.js + MediaPipe/ONNX + 原生 FFmpeg

理由：

- 复用网页方案最多
- 开发速度最快
- UI 能做得比较好
- 本地 FFmpeg 能解决导出性能和稳定性问题
- 适合免费小工具快速发布

### 12.2 如果你想做轻量、高质量、长期维护的本地 App

推荐：

> Tauri + React/Vue + Rust 后端 + 原生 FFmpeg + ONNX/MediaPipe

理由：

- 更轻
- 更符合本地隐私工具气质
- 性能更好
- 长期架构更干净

代价是工程难度更高。

### 12.3 如果你想先把算法做好

推荐：

> Python + PySide6 + OpenCV + MediaPipe + FFmpeg

理由：

- 算法验证最快
- 调试人脸点、对齐参数、视频生成最方便
- 很适合先做内部工具

但不建议直接作为最终消费者产品，除非能接受打包和 UI 质感问题。

### 12.4 如果第一批用户主要是 Mac 用户

推荐：

> SwiftUI + Vision + Core Image + AVFoundation

理由：

- 体验最好
- 性能强
- 不需要打包大模型和 FFmpeg
- 和 macOS 隐私、本地照片处理的叙事非常匹配

缺点是不能覆盖 Windows。

## 13. 总体结论

本地 App 版本我建议有两条现实路线：

1. 快速产品路线：Electron + Node.js + 原生 FFmpeg
2. 长期精品路线：Tauri + Rust + 原生 FFmpeg

如果这个项目目前还在验证产品价值，优先 Electron。  
如果你已经确定要长期做一个轻量桌面工具，优先 Tauri。  
如果你还没验证算法效果，先用 Python 做一个内部原型最快。

