# News Pulse — UI / UX Design

## 1. Design Objective

The frontend should make the central idea immediately understandable:

> News topics appear as clusters that remain active across a period of time.

The assessment states that the timeline carries significant weight and should be polished and genuinely useful.

---

## 2. Main Screen

Recommended structure:

```text
┌─────────────────────────────────────────────────────────────┐
│ News Pulse                                  [Refresh Data]   │
│ Topic-clustered news timeline                               │
├─────────────────────────────────────────────────────────────┤
│ Sources: [All] [BBC] [NPR] [Source 3]                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Timeline                                                   │
│                                                             │
│  Sep 22       Sep 22       Sep 22       Sep 22             │
│     │            │            │            │               │
│     │   ┌──────────────┐                                    │
│     │   │ Global       │                                    │
│     │   │ Markets      │───────────┐                        │
│     │   └──────────────┘           │                        │
│     │                              │                        │
│     │          ┌──────────────────────────┐                 │
│     │          │ Election / Politics      │                 │
│     │          └──────────────────────────┘                 │
│     │                                                        │
└─────────────────────────────────────────────────────────────┘
```

The exact visual implementation is flexible.

---

## 3. Timeline

Each cluster should visually span:

```text
earliest article
      ↓
[start ============================ end]
```

The horizontal position communicates time.

The block/marker communicates topic.

The size/intensity can communicate article count.

---

## 4. Cluster Card

When the user clicks a cluster, show a drawer/modal/panel.

Example:

```text
┌─────────────────────────────────────┐
│ Global Markets                   X  │
│                                     │
│ 5 articles                          │
│ Sep 22, 06:30 → Sep 22, 10:20       │
│                                     │
│ BBC                                 │
│ Markets react to ...                │
│ 10:20 AM                            │
│ [Read article ↗]                    │
│                                     │
│ NPR                                 │
│ Investors respond to ...            │
│ 09:45 AM                            │
│ [Read article ↗]                    │
└─────────────────────────────────────┘
```

Required article information:

- headline;
- source;
- published time;
- original article link.

---

## 5. Source Filter

Use compact toggles/chips:

```text
Sources

[✓ All] [✓ BBC] [✓ NPR] [✓ Source 3]
```

Filtering should change which articles/clusters are represented.

Recommended behavior:

- All = every source;
- source selected = only selected sources;
- multiple sources can be selected.

---

## 6. Refresh Flow

Button:

```text
[↻ Refresh Data]
```

States:

```text
Idle
↓
Refreshing…
↓
Collecting articles…
↓
Grouping topics…
↓
Updating timeline…
↓
Updated just now
```

The frontend should actually call:

```text
POST /ingest/trigger
```

Then poll:

```text
GET /ingest/status/:jobId
```

After completion:

```text
GET /timeline
```

---

## 7. Loading State

Use skeletons or a simple loading indicator.

Avoid showing a blank page.

---

## 8. Error State

Example:

```text
Unable to load the news timeline.

[Try again]
```

For refresh failure:

```text
Refresh failed. Existing timeline data is still available.

[Try again]
```

---

## 9. Empty State

If no data exists:

```text
No news clusters available yet.

Run an ingestion to collect the latest articles.

[Refresh Data]
```

---

## 10. Responsive Design

Desktop is the primary review experience, but the UI should not break on smaller screens.

On mobile:

- allow horizontal scrolling for timeline;
- cluster details can use a full-screen drawer;
- source filters can wrap.

---

## 11. Visual Hierarchy

Priority:

1. timeline;
2. cluster labels;
3. time;
4. source filter;
5. cluster details;
6. refresh action.

Do not let navigation or branding consume most of the viewport.

---

## 12. Suggested Component Tree

```text
App
├── Header
│   ├── Logo/Title
│   └── RefreshButton
├── SourceFilter
├── Timeline
│   ├── TimeAxis
│   └── ClusterMarker[]
└── ClusterDrawer
    └── ArticleList
        └── ArticleCard[]
```

---

## 13. Accessibility

- buttons must be keyboard accessible;
- links must have meaningful text;
- modal/drawer should be closable with Escape;
- do not rely only on color to distinguish sources;
- provide readable contrast.

---

## 14. Design Principle

Do not build a generic admin dashboard.

Build a focused news-exploration product where the timeline is the hero.
