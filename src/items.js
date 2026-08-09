// Hardcoded 30-item catalog, matching the TicketDesk Student TODO Worksheet
// exactly. Do not alter or invent items here without updating the worksheet.

const BACKEND_ITEMS = [
  { number: 1, text: 'Agent branch of the permission matrix' },
  { number: 2, text: 'Requester branch of the permission matrix' },
  { number: 3, text: 'Remaining ticket workflow transitions + role guards' },
  { number: 4, text: 'Retrofit 2 endpoints to the shared response/error format' },
  { number: 5, text: 'Input validation on the ticket-creation endpoint' },
  { number: 6, text: 'Rate limiting on a second endpoint beyond login' },
  { number: 7, text: 'Wire the chat → notification bridge for offline participants' },
  { number: 8, text: 'Implement GET /api/health' },
  { number: 9, text: 'One unit test for a workflow transition not already covered' },
  { number: 10, text: 'Required custom header check on a second endpoint' },
  { number: 11, text: "Add the correct ref relation + .populate() on a chosen endpoint" },
  { number: 12, text: 'Design and add a compound index for a given access pattern' },
  { number: 13, text: 'Write the second dashboard aggregation stage' },
  { number: 14, text: 'Implement search-filter logic in the query-builder helper' },
  { number: 15, text: 'Implement sort logic in the query-builder helper' },
  { number: 16, text: 'Implement pagination (skip/limit) logic in the query-builder helper' }
];

const FRONTEND_ITEMS = [
  { number: 1, text: 'TicketContext provider + useTicketContext() hook' },
  { number: 2, text: 'FilterBar component (useState)' },
  { number: 3, text: 'Pagination component (useState)' },
  { number: 4, text: 'useEffect data fetching on the ticket-list page' },
  { number: 5, text: 'Correct cleanup/AbortController in a useEffect' },
  { number: 6, text: 'NotificationBell dropdown state + click-outside handling' },
  { number: 7, text: 'ChatBox message input state + socket emit on send' },
  { number: 8, text: 'AttachmentUploader file-select state + upload progress' },
  { number: 9, text: "Wire AppLayout into two pages that don't use it yet" },
  { number: 10, text: 'Loading/skeleton state on one data-fetching page' },
  { number: 11, text: 'A custom hook extracting logic duplicated across two components' },
  { number: 12, text: 'Client-side validation feedback on the create/edit ticket Modal' },
  { number: 13, text: 'Socket.io connection lifecycle — connect on login, disconnect on logout' },
  { number: 14, text: 'Empty-state UI on the ticket-list page' }
];

module.exports = { BACKEND_ITEMS, FRONTEND_ITEMS };
