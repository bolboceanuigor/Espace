import ConnectWorkspace, { type ConnectPrefill } from '@/components/connect/ConnectWorkspace';

type PageSearchParams = Record<string, string | string[] | undefined>;

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function connectPrefill(searchParams?: PageSearchParams): ConnectPrefill | undefined {
  if (!searchParams) return undefined;
  return {
    new: first(searchParams.new) === '1',
    type: first(searchParams.type) as ConnectPrefill['type'],
    apartmentId: first(searchParams.apartmentId),
    subject: first(searchParams.subject),
    relatedInvoiceId: first(searchParams.relatedInvoiceId),
    relatedServiceTicketId: first(searchParams.relatedServiceTicketId),
    relatedMeterReadingId: first(searchParams.relatedMeterReadingId),
    relatedPaymentProofId: first(searchParams.relatedPaymentProofId),
  };
}

export default function AdminConnectPage({ searchParams }: { searchParams?: PageSearchParams }) {
  return <ConnectWorkspace mode="admin" prefill={connectPrefill(searchParams)} />;
}
