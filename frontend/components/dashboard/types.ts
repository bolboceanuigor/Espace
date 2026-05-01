export type DashboardMetrics = {
  totalProperties: number;
  totalReservations: number;
  monthlyRevenue: number;
  occupancyRate: number;
};

export type Reservation = {
  id: string;
  checkIn: string;
  totalPrice: number;
  status: string;
  guestName?: string;
};
