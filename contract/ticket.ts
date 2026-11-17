export type Line = {
  id: number
  dish: string
  quantity: number
  note: string | null
}

export type TicketStatus = 'todo' | 'in-progress' | 'ready'

export type Ticket = {
  id: number
  number: number // numéro d'envoi
  table: number
  status: TicketStatus
  lines: Line[]
}

// GET  /api/kitchen/tickets              → Ticket[], dans l'ordre d'affichage
// POST /api/kitchen/tickets/:id/advance  → Ticket, ou 409 { error: string }
