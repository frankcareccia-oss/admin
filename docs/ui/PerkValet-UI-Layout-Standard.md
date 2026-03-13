\# PerkValet UI Layout Standard

Version: 1.0  

Purpose: Establish a consistent UI layout contract across the PerkValet Admin and Merchant interfaces.



This document defines the layout architecture, container sizing, and UI structural patterns that must be followed across the application.



These rules exist to prevent layout drift, UI inconsistency, and repeated redesign discussions across development threads.



---



\# 1. Core Layout Architecture



All application pages must follow this structure:



```

AppShell

&nbsp;├── Header

&nbsp;└── Main

&nbsp;     └── PageContainer

&nbsp;          ├── PageHeader

&nbsp;          └── Card / Sections

```



This ensures consistent visual hierarchy and predictable page structure.



---



\# 2. App Shell Contract (App.jsx)



`App.jsx` is responsible only for \*\*viewport structure\*\*, not page layout.



Responsibilities:



\- Define the application shell

\- Provide header and scrolling area

\- Control viewport height



Example shell structure:



```jsx

<AppShell>

&nbsp; <Header />

&nbsp; <MainArea>

&nbsp;   {routes}

&nbsp; </MainArea>

</AppShell>

```



Recommended shell layout:



```

display: grid

grid-template-rows: 56px 1fr

min-height: 100vh

```



Rules:



\- App.jsx \*\*must NOT control page width\*\*

\- App.jsx \*\*must NOT contain max-width rules\*\*

\- App.jsx \*\*must NOT center page content\*\*



Page layout is controlled by \*\*PageContainer only\*\*.



---



\# 3. PageContainer Contract



All page width constraints are managed by the `PageContainer` component.



PageContainer must support \*\*exactly four sizes\*\*.



| Size | Width | Usage |

|-----|------|------|

| form | 760px | create/edit forms |

| page | 1100px | detail pages |

| wide | 1400px | lists and dashboards |

| full | 1760px | dense tables / reports |



Example implementation:



```javascript

const PAGE\_WIDTHS = {

&nbsp; form: 760,

&nbsp; page: 1100,

&nbsp; wide: 1400,

&nbsp; full: 1760

}

```



Container behavior:



```

width: 100%

max-width: <size>

margin: 0 auto

```



Rules:



\- Do not introduce additional container sizes

\- Do not override container width at page level

\- Do not set max-width anywhere except PageContainer



---



\# 4. PageHeader Contract



Every page begins with a PageHeader.



Structure:



```

PageHeader

&nbsp;├── Title

&nbsp;├── Subtitle / description

&nbsp;└── PageActions

```



Layout behavior:



\- Title left

\- Actions right

\- Responsive wrapping allowed



Example layout:



```

display: flex

justify-content: space-between

align-items: flex-start

gap: 16px

```



Rules:



\- Page title must be consistent size across pages

\- Subtitle text should be concise and human-readable

\- Actions should be compact pill buttons



---



\# 5. Card Layout Standard



All page sections should be wrapped in cards.



Card style:



```

background: #ffffff

border: 1px solid rgba(0,0,0,0.12)

border-radius: 14px

box-shadow: 0 1px 2px rgba(0,0,0,0.04)

```



Card structure:



```

Card

&nbsp;├── CardHeader

&nbsp;└── CardBody

```



Header style:



```

padding: 14px 16px

border-bottom: 1px solid rgba(0,0,0,0.08)

```



Body style:



```

padding: 16px

```



Rules:



\- Cards must use consistent border radius and padding

\- Avoid custom card styling per page

\- Avoid off-white card backgrounds



---



\# 6. Section Spacing



Sections within a page should be stacked using a consistent grid spacing.



```

display: grid

gap: 16px

```



This ensures consistent vertical rhythm across pages.



---



\# 7. List / Row Layout Standard



All list views (stores, users, invoices) should follow a consistent row model.



Typical row fields:



For people:



```

Name

Phone

Email

Status

Actions

```



For stores:



```

Store name

City / State

Contact

Status

Actions

```



Rules:



\- Avoid reordering columns between pages

\- Avoid dense table layouts unless required

\- Maintain consistent row padding and spacing



---



\# 8. Form Layout Standard



Forms should use a consistent grid system.



Example form grid:



```

grid-template-columns: repeat(12, 1fr)

gap: 14px

```



Typical spans:



| Span | Usage |

|-----|------|

| 12 | full-width fields |

| 6 | paired inputs |

| 4 | smaller grouped fields |



Input styling:



```

height: 40px

border-radius: 10px

border: 1px solid rgba(0,0,0,0.14)

padding: 0 12px

```



Rules:



\- Input heights must remain consistent

\- Labels must be consistent size

\- Helper text should be minimal and human readable



---



\# 9. Action Button Standard



Primary actions use compact pill buttons.



Primary button:



```

height: 36px

border-radius: 999px

padding: 0 14px

font-size: 13px

font-weight: 600

```



Rules:



\- Only one primary action per area

\- Avoid oversized buttons

\- Use secondary pills for supporting actions



---



\# 10. Page Type Mapping



Recommended container usage:



| Page | Container |

|-----|-----|

| MerchantStores | wide |

| MerchantUsers | wide |

| MerchantStoreDetail | page |

| MerchantStoreCreate | form |

| MerchantInvoices | wide |

| MerchantInvoiceDetail | page or wide |



---



\# 11. Global CSS Rules



Global CSS should only handle:



\- resets

\- typography

\- colors

\- box-sizing



Global CSS must \*\*not\*\* control layout width.



Forbidden patterns:



```

body { display:flex }

\#root { max-width }

margin: auto on root containers

```



---



\# 12. Operational Rule



When starting a new development thread:



\- This document is the \*\*UI layout authority\*\*

\- Layout architecture must follow this contract

\- Avoid redesign discussions unless the architecture itself must change



---



\# 13. Summary



The layout contract ensures:



\- consistent page width

\- predictable page structure

\- minimal UI drift

\- faster development across threads



All UI work should conform to this layout standard.

