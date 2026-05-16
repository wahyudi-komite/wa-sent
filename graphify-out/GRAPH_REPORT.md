# Graph Report - .  (2026-05-16)

## Corpus Check
- Corpus is ~5,110 words - fits in a single context window. You may not need a graph.

## Summary
- 105 nodes · 194 edges · 8 communities detected
- Extraction: 74% EXTRACTED · 26% INFERRED · 0% AMBIGUOUS · INFERRED: 51 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_App Bootstrap & Module Wiring|App Bootstrap & Module Wiring]]
- [[_COMMUNITY_WhatsApp Connection & Sending|WhatsApp Connection & Sending]]
- [[_COMMUNITY_Scheduler & Health Checks|Scheduler & Health Checks]]
- [[_COMMUNITY_External Dependencies & Documentation|External Dependencies & Documentation]]
- [[_COMMUNITY_HTTP API Controllers|HTTP API Controllers]]
- [[_COMMUNITY_Screenshot Capture|Screenshot Capture]]
- [[_COMMUNITY_NestJS Module Configuration|NestJS Module Configuration]]
- [[_COMMUNITY_Logging Service Internals|Logging Service Internals]]

## God Nodes (most connected - your core abstractions)
1. `WhatsappService` - 18 edges
2. `ReportSchedulerService` - 13 edges
3. `AppLoggerService` - 9 edges
4. `ScreenshotService` - 8 edges
5. `WhatsappController` - 7 edges
6. `AppModule` - 5 edges
7. `ReportSchedulerService` - 5 edges
8. `WhatsappService` - 5 edges
9. `WA-SENT Project` - 5 edges
10. `HealthController` - 3 edges

## Surprising Connections (you probably didn't know these)
- `ReportSchedulerService` --conceptually_related_to--> `Global Queue Architecture`  [INFERRED]
  src/scheduler/report-scheduler.service.ts → README.md
- `WA-SENT Project` --conceptually_related_to--> `P2-PED08715D Server`  [INFERRED]
  README.md → deploy.txt
- `AppModule` --references--> `HealthModule`  [EXTRACTED]
  src/app.module.ts → src/health/health.module.ts
- `AppModule` --references--> `LoggerModule`  [EXTRACTED]
  src/app.module.ts → src/logger/logger.module.ts
- `AppModule` --references--> `ScreenshotModule`  [EXTRACTED]
  src/app.module.ts → src/screenshot/screenshot.module.ts

## Communities

### Community 0 - "App Bootstrap & Module Wiring"
Cohesion: 0.13
Nodes (8): HealthController, HealthModule, LoggerModule, SchedulerModule, ScreenshotModule, AppModule, bootstrap(), WhatsappModule

### Community 1 - "WhatsApp Connection & Sending"
Cohesion: 0.26
Nodes (1): WhatsappService

### Community 2 - "Scheduler & Health Checks"
Cohesion: 0.19
Nodes (2): ReportSchedulerService, SchedulerController

### Community 3 - "External Dependencies & Documentation"
Cohesion: 0.15
Nodes (15): P2-PED08715D Server, @whiskeysockets/baileys, Puppeteer, HealthController, AppLoggerService, Auto-Cleanup, Dynamic Scheduling, Global Queue Architecture (+7 more)

### Community 4 - "HTTP API Controllers"
Cohesion: 0.22
Nodes (1): WhatsappController

### Community 5 - "Screenshot Capture"
Cohesion: 0.43
Nodes (1): ScreenshotService

### Community 6 - "NestJS Module Configuration"
Cohesion: 0.53
Nodes (6): AppModule, HealthModule, LoggerModule, SchedulerModule, ScreenshotModule, WhatsappModule

### Community 7 - "Logging Service Internals"
Cohesion: 0.6
Nodes (1): AppLoggerService

## Knowledge Gaps
- **16 isolated node(s):** `AppModule`, `HealthModule`, `LoggerModule`, `SchedulerModule`, `ScreenshotModule` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `WhatsApp Connection & Sending`** (20 nodes): `.error()`, `.log()`, `.handleDailyCleanup()`, `.cleanupOldScreenshots()`, `WhatsappService`, `.cleanup()`, `.cleanupSocket()`, `.connect()`, `.constructor()`, `.delay()`, `.deleteSession()`, `.handleConnectionUpdate()`, `.listGroups()`, `.logout()`, `.onModuleDestroy()`, `.onModuleInit()`, `.scheduleReconnect()`, `.sendImage()`, `.sendImageToTargets()`, `.sendText()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scheduler & Health Checks`** (18 nodes): `.debug()`, `.warn()`, `ReportSchedulerService`, `.cleanupScreenshot()`, `.constructor()`, `.generateCaption()`, `.getTargets()`, `.getUrls()`, `.handleHeartbeat()`, `.handleScheduledReport()`, `.onModuleInit()`, `.processQueue()`, `.setupDynamicCron()`, `.waitForConnection()`, `SchedulerController`, `.constructor()`, `.triggerManual()`, `.validateConnection()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `HTTP API Controllers`** (9 nodes): `.check()`, `WhatsappController`, `.constructor()`, `.getQr()`, `.getStatus()`, `.logout()`, `.sendImage()`, `.sendText()`, `.getConnectionStatus()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Screenshot Capture`** (7 nodes): `ScreenshotService`, `.closeBrowser()`, `.constructor()`, `.getBrowser()`, `.onModuleDestroy()`, `.takeMultipleScreenshots()`, `.takeScreenshot()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Logging Service Internals`** (5 nodes): `AppLoggerService`, `.constructor()`, `.ensureLogDir()`, `.verbose()`, `.writeLog()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WhatsappService` connect `WhatsApp Connection & Sending` to `App Bootstrap & Module Wiring`, `Scheduler & Health Checks`, `HTTP API Controllers`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Why does `ReportSchedulerService` connect `Scheduler & Health Checks` to `App Bootstrap & Module Wiring`, `WhatsApp Connection & Sending`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `WhatsappController` connect `HTTP API Controllers` to `App Bootstrap & Module Wiring`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `AppModule`, `HealthModule`, `LoggerModule` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Bootstrap & Module Wiring` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._