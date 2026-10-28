import { apiTransport } from './apiTransport';

export type GudepGateStatus = 'NOT_ARRIVED' | 'CHECKED_IN' | 'CHECKED_OUT';
export type GudepQrInfo = {
  gudep_id: string; gudep_name: string; gudep_number: string;
  verification_status: string; activation_status: string;
  gate_status: GudepGateStatus; token_present: boolean; qr_token: string;
  /** Computed by GAS from the authenticated caller's active roles. */
  can_scan?: boolean;
};
export type GudepGateLog = {
  log_id: string; event_id: string; gudep_id: string;
  direction: 'CHECK_IN' | 'CHECK_OUT'; gate_name: string;
  officer_user_id: string; created_at: string;
};
async function send<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const response = await apiTransport.send<T>(action, payload, {timeoutMs:45000});
  if (!response.ok || !response.data) throw new Error(response.error?.message || `GAS gagal: ${action}`);
  return response.data;
}
export const gudepQrService = {
  get: (gudep_id: string) => send<GudepQrInfo>('gudep.qr.get', {gudep_id}),
  issue: (gudep_id: string) => send<{gudep_id:string;qr_token:string;already_exists:boolean}>('gudep.qr.issue', {gudep_id}),
  history: (gudep_id: string) => send<Omit<GudepQrInfo,'qr_token'> & {history:GudepGateLog[]}>('gudep.qr.history', {gudep_id}),
  scan: (token: string, direction: 'CHECK_IN' | 'CHECK_OUT', gate_name = 'Gerbang Utama') =>
    send<{gudep_id:string;gudep_name:string;gate_status:GudepGateStatus;already_processed:boolean;message:string;logged_at?:string}>(
      'gudep.qr.scan', {token,direction,gate_name}),
};
