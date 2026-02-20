export type OpType = "create" | "update" | "delete";

export type OplogEntry = {
  id: string;
  task_id: string;
  device_id: string;
  op_type: OpType;
  field: string | null;
  value: string | null;
  timestamp: string;
};
