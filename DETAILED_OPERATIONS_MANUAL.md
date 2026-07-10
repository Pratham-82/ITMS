# ApexResolve Detailed Operations & Configuration Manual

This manual provides deep technical and operational documentation for the **ApexResolve Complaint & Case Management System**. It covers advanced configurations, step-by-step setup guides, underlying mathematical formulas, and system failsafes for administrators and developers.

---

## Chapter 1: Multi-Tenancy & Database Scoping

ApexResolve runs a database-per-tenant architecture. The system isolates data at rest by creating separate MongoDB databases for each tenant under the pattern `apexresolve_<tenantId>`, while keeping global system records in the central `apexresolve` database.

### 1.1 Tenant Context Resolution
The API server intercepts all requests via the [tenantMiddleware](file:///c:/Users/gamer/Downloads/CMS/CMS/backend/middleware/tenantMiddleware.js). The resolution order is:

1. **Header Inspection**: Looks for `x-tenant-id`. This is primarily used by mobile clients, custom portal webhooks, and backend-to-backend integrations.
2. **Query Parameters**: Checks `?tenantId=...`. Useful for troubleshooting.
3. **Subdomain Extraction**: Resolves the subdomain of the request host:
   - For `acme.localhost:5001`, the resolved tenant is `acme`.
   - For Render app URLs like `acme.itms-app.onrender.com`, it correctly extracts `acme` (ignoring the primary app container subdomain).
   - If no tenant subdomain is found, it defaults to `default-tenant`.

### 1.2 Mongoose Schema Proxying
To route queries to the correct database without restarting the app, ApexResolve utilizes a custom Javascript Proxy helper called [createTenantModelProxy](file:///c:/Users/gamer/Downloads/CMS/CMS/backend/models/tenantModelHelper.js):
* Models like `Ticket`, `User`, and `SlaConfiguration` are wrapped in this proxy.
* When a query is called (e.g., `Ticket.find(...)`), the proxy intercepts the call, fetches the active `tenantId` from Node's Asynchronous Local Storage (`tenantLocalStorage`), creates or retrieves a cached database connection via `mongoose.connection.useDb('apexresolve_' + tenantId)`, and executes the query on that database.

### 1.3 Central Registry Database
The following models bypass tenant-specific databases and reside solely in the central `apexresolve` database:
* **Tenant**: Stores tenant status, branding assets, custom colors, and subdomain registries.
* **GlobalUser**: A central registry mapping user emails to their respective tenant workspaces. This prevents email conflicts across organizations and routes users to the correct workspace upon login.

---

## Chapter 2: The SLA Calculation Engine

The SLA (Service Level Agreement) engine is the core compliance driver of ApexResolve. It calculates the exact **Response Due At** and **Resolution Due At** deadlines in business time.

```
[Start Time] 
    │
    ▼
Does "now" overlap with Maintenance/Blackout? ──(Yes)──> Skip to Window End
    │
    ▼ (No)
Is "now" outside Working Hours/Days? ───────────(Yes)──> Skip to Next Working Day Start
    │
    ▼ (No)
Add remaining SLA minutes (up to end of current working day)
    │
    ▼
SLA Targets Met? ──(No)──> Repeat for next business day
    │
    ▼ (Yes)
[Calculate Due Date]
```

### 2.1 Timezone-Aware Date Calculations
To prevent DST (Daylight Saving Time) shifts and timezone discrepancies, the [calendarService](file:///c:/Users/gamer/Downloads/CMS/CMS/backend/services/calendarService.js) uses `Intl.DateTimeFormat` to format dates into numeric components:
$$\text{Date Parts} = \{\text{Year, Month, Day, Hour, Minute, Second, Weekday}\}$$
Calculations are converted to UTC Unix timestamps, processed, and then mapped back to the target timezone's coordinate space.

### 2.2 Standard Working Hours Rollover
The engine moves time forward using a segment-by-segment check:
1. **Weekend Check**: If the date falls on a day not included in the calendar's `workingDays` (e.g., Saturday/Sunday), the clock advances to the start hour of the next working day.
2. **Non-Working Hours Check**: If the date falls outside the `workingHours.start` and `workingHours.end` range:
   - If it is before the start hour, the clock advances to the start hour of the same day.
   - If it is after the end hour, the clock advances to the start hour of the next working day.

### 2.3 Pauses: Holidays, Blackouts, & Maintenance
Three override mechanisms pause SLA timers:
* **Holidays**:
  - *Standard Holidays*: Single-date events (e.g., July 4th, 2026). If the current day matches a holiday, it is treated as a weekend.
  - *Recurring Holidays*: Annual holidays (e.g. Christmas on December 25th). The year part is ignored during matching.
* **Blackout Periods**: Complete system freezes. While a blackout is active on a calendar, SLA timers are completely frozen. The clock automatically jumps to the blackout end date.
* **Maintenance Windows**: Pauses SLA timers for maintenance events. Maintenance windows can be restricted to specific departments:
  - If a ticket is routed to `IT Helpdesk` and a maintenance window is active for `IT Helpdesk`, its SLA timers are paused.
  - A ticket in the `Facilities` department will continue to run its SLA timers normally during that window.

---

## Chapter 3: AI Triage & Classification

ApexResolve uses the **Google Gemini API** to classify tickets and route them to the correct departments and categories automatically.

### 3.1 LLM Classification Process
When a ticket is filed, the system builds a structured prompt containing:
1. The ticket's title and description.
2. The list of active departments.
3. The list of active categories mapped to those departments.

The LLM returns a structured JSON payload:
```json
{
  "department": {
    "name": "IT Support",
    "confidence": 0.95,
    "reasoning": "The user is requesting a password reset which is handled by the IT support team."
  },
  "category": {
    "name": "IT Software",
    "confidence": 0.92,
    "reasoning": "Password resets fall under software application access control."
  }
}
```

### 3.2 Threshold Actions
Administrators configure two confidence thresholds:
* **Auto-Accept Threshold (e.g. 0.85)**: If the LLM confidence score for BOTH department and category is $\ge 0.85$, the ticket is automatically assigned and routed.
* **Suggestion Threshold (e.g. 0.70)**: If the confidence score is between $0.70$ and $0.84$, the system saves the prediction and displays it as a suggestion on the staff ticket details page, but does not auto-route the ticket.
* **Manual Routing (Below 0.70)**: If the confidence score is below $0.70$, the AI routing is bypassed and the ticket is queued for manual triage.

### 3.3 Prompt Version Control & Configuration Auditing
To prevent issues when adjusting AI behaviors:
* All prompts are versioned. When you save a new prompt in the admin panel, the system increments the version number and assigns it as the active prompt in `AiSettings`.
* **Rollbacks**: If the new prompt causes routing errors, you can roll back to a previous version to restore the prior system prompt configuration.
* **Audit Trail**: Every settings change, prompt update, and rollback action creates a record in `AiConfigAuditLog` containing the actor's username, timestamp, and a diff of the changes.

---

## Chapter 4: Deduplication & Impact Scoring

During major outages, support desks can be flooded with duplicate tickets. ApexResolve uses a duplicate detection and consolidation engine to manage these events.

### 4.1 Real-Time Similarity Engine
When a user drafts a ticket, the frontend sends the title and description to `/api/duplicates/check`. The system checks for matching active tickets in the same category. If a match is found, the user is prompted to support the existing ticket instead of submitting a new one.

### 4.2 Impact Score Math
When users support a master ticket, its **Impact Score** increases. This score represents user pressure and is calculated as:
$$\text{Impact Score} = \text{Supporters Count} \times \text{Severity Weight} \times \text{Category Weight}$$

#### Severity Weight Configuration
* `Low`: 1
* `Medium`: 2
* `High`: 3
* `Critical`: 4

#### Category Weight Configuration
* **System Outage, Server Failure, Pipe Leakage, Critical Repairs**: 2.0
* **Billing Discrepancy, Refunds, Access Requests**: 1.5
* **General Inquiries, Feedback**: 1.0

### 4.3 Automated Priority Escalations
As supporters join a ticket, the system automatically elevates the ticket's priority level:
* **10 Supporters**: Escalates priority to **Medium**
* **25 Supporters**: Escalates priority to **High**
* **50 Supporters**: Escalates priority to **Critical**

*Note: When priority escalates, the system recalculates the SLA deadlines using the target response and resolution times of the new priority level.*

### 4.4 Ticket Merging & Consolidation
If multiple duplicate tickets are submitted, admins can merge them into a single master ticket:
1. The duplicate tickets are marked as `Closed` with the closure type set to `Auto Closed`.
2. A link is created using the `parentTicketId` field referencing the master ticket.
3. All attachments from the duplicate tickets are appended to the master.
4. Comments and history records from the duplicate tickets are consolidated into the master ticket. Merged comments are prefixed with `[Merged from CMS-XXXX]`.
5. The master ticket's supporter list is updated with any unique users from the duplicates, and its Impact Score and priority are recalculated.

---

## Chapter 5: Auto-Assignment & Workload Balancing

The system uses a capacity-aware auto-assignment engine to distribute tickets to support staff.

### 5.1 Workload Score Calculations
The system calculates a dynamic **Workload Score** for each agent:
$$\text{Workload Score} = \sum (\text{Priority Weights}) + \text{SLA Risk Penalties}$$

#### Priority Weights
* `Low` ticket: +1 point
* `Medium` ticket: +2 points
* `High` ticket: +3 points
* `Critical` ticket: +5 points (+2 extra points for critical status)

#### SLA Risk Penalties
* Ticket within **24 hours** of SLA breach: +3 points
* Ticket within **2 hours** of SLA breach: +5 points

#### Capacity Utilization
The agent's capacity utilization is calculated as:
$$\text{Utilization \%} = \left( \frac{\text{Workload Score}}{\text{Max Capacity}} \right) \times 100$$

### 5.2 Auto-Assignment Strategies
When a ticket is routed, the system uses one of the following strategies:
1. **Workload-Based (Recommended)**: Assigns the ticket to the agent in the department/group with the lowest Workload Score.
2. **Least Tickets**: Assigns to the agent with the fewest active, open tickets.
3. **Round-Robin**: Rotates assignments sequentially using in-memory pointers.
4. **Skill-Based**: Filters agents by skills matching the ticket category, then selects the agent with the fewest tickets.

*If no agents are set to "Available", the system falls back to busy or offline agents in the department, or routes the ticket to the group leader.*

### 5.3 Workload Transfers & Reassignments
* **Manual Transfer**: Admins can transfer a ticket to another agent. This action updates both agents' Workload Scores and sends them notifications.
* **Bulk Reassignment**: If an agent goes on leave, admins can transfer all of their active tickets to another agent or route them back to the unassigned queue.

---

## Chapter 6: Workflow Designer & Custom Metadata

Administrators can customize ticket lifecycles and define custom data fields for each category.

### 6.1 State Machine Rules & Reserved States
Workflows use a state machine model. To maintain compatibility with core system triggers, all workflows must include the following system-reserved states:
* `Pending`: The initial state for newly submitted tickets.
* `Awaiting Feedback`: Used when requesting input or confirmation from the user.
* `Closed`: The final resolved state.
* `Reopen Requested`: Used when a user requests to reopen a closed ticket.

Admins can add custom intermediate states (e.g., `In Triaging`, `Waiting for Parts`, `Escalated to Vendor`).

### 6.2 Transition Configurations
Transitions define the path between states. Each transition can configure:
* **Allowed Role**: Restricts who can trigger the transition (`admin`, `citizen`, or `any`).
* **Auto-Routing**: Automatically transfers the ticket to a specified department when the transition is triggered.
* **Escalation Overrides**: Sets a specific target completion window (in hours) for the next step in the workflow.

*Note: Admins cannot delete a workflow state if there are open tickets currently in that state.*

### 6.3 Custom Fields Registry (Metadata)
Administrators can register custom fields for the `TICKET` entity under the Metadata Registry:
* **Supported Types**: Text, textarea, number, currency, boolean, date, datetime, email, phone, url, select, multiselect, user reference, group reference, reference, json, richtext, attachment, and formula.
* **Display Rules**: Configure conditional field visibility based on other field values.
  - *Example*: Show the field `macAddress` only if `category` equals `IT Hardware`.
* **Validation Rules**: Set validation requirements (e.g. required, unique) and add regex validations with custom error messages.

---

## Chapter 7: Webhooks & System Integration

Administrators can connect ApexResolve to external systems (such as Slack, Microsoft Teams, or custom APIs) using webhooks.

### 7.1 Webhook Dispatch Signatures
When an event occurs, the system compiles a JSON payload and dispatches it as an HTTP POST request. To verify the payload's authenticity, the receiver can validate the header signature:
* The header `X-Hub-Signature-256` contains an HMAC SHA256 signature.
* This signature is generated by hashing the raw request body using the webhook's configured secret key.

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

### 7.2 Event Catalog
* `ticket.created`: Dispatched when a new ticket is opened.
* `ticket.updated`: Dispatched when status, priority, or assignees change.
* `ticket.sla_breached`: Dispatched when SLA response or resolution timers expire.
* `ticket.comment_added`: Dispatched when customer or staff add messages.
* `webhook.test`: Custom diagnostic event.

---

## Chapter 8: Troubleshooting & Diagnostic Operations

### 8.1 Resolving DB Index Conflicts
If you encounter unique index errors when registering duplicate categories or fields across different organizations, run the database index migration script:
```bash
npm run migrate-indexes
```
This drops legacy single-field unique indexes and replaces them with compound indexes scoped by `tenantId`.

### 8.2 AI Failsafe Mode
If the Gemini API is down, returns errors, or times out:
* The system logs the failure in `AiRoutingLog` under the error types `Timeout` or `APIError`.
* The server automatically switches to **Failsafe Mode**, routing the ticket to the manual queue to prevent submission errors.
* To check the AI status, navigate to the **AI Settings Panel** and view the health dashboard (latency and error telemetry).

### 8.3 Cache Operations
To resolve issues where changes to category routing rules are not immediately applied, clear the AI classification cache:
1. Navigate to **AI Settings** $\rightarrow$ **Cache Management**.
2. Click **Clear Cache**. This flushes the in-memory cache and forces the system to query the Gemini model for subsequent requests.
