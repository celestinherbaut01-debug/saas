import type { RepairOrder } from "@/lib/supabase/types";
export const GARAGE_NEXT_STATUS:Partial<Record<RepairOrder["status"],RepairOrder["status"]>>={diagnostic:"quote",quote:"accepted",accepted:"in_progress",waiting_parts:"in_progress",in_progress:"done",done:"delivered"};
export function garageWorkshopStage(order:RepairOrder,now=new Date()):RepairOrder["status"]|"upcoming" {
 return order.status==="diagnostic"&&order.scheduled_at&&new Date(order.scheduled_at)>now?"upcoming":order.status;
}
