| Imagen | Tag | Tamaño | Capas | Build en frío | Rebuild tras cambio de código |
|---|---|---|---|---|---|
| Frontend basico | `chat-web:basic` | 2907 MB | 12 | 88s | 58s |
| Frontend multi-stage | `chat-web:1.0` | 326 MB | 9 | 41s | 13s |
| Backend basico | `chat-api:basic` | 938 MB | 19 | 43s | 11s |
| Backend multi-stage | `chat-api:1.0` | 184 MB | 23 | 55s | 6s |

_Medido el 2026-10-24 con Docker version 29.9.2, build a82e528._
