| Imagen | Tag | Tamaño | Capas | Build en frío | Rebuild tras cambio de código |
|---|---|---|---|---|---|
| Frontend basico | `chat-web:basic` | 2907 MB | 12 | 80s | 65s |
| Frontend multi-stage | `chat-web:1.0` | 326 MB | 9 | 48s | 15s |
| Backend basico | `chat-api:basic` | 938 MB | 19 | 32s | 13s |
| Backend multi-stage | `chat-api:1.0` | 185 MB | 23 | 55s | 8s |

_Medido el 2026-10-24 con Docker version 29.9.2, build a82e528._
