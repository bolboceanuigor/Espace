# Final MVP Demo Checklist

1) Start local stack:

```bash
./dev.sh
```

2) Login superadmin:
- `bolboceanuigor@gmail.com` / `SuperAdmin123!`

3) Add property:
- open `/{locale}/properties`
- create one apartment

4) Create reservation from calendar:
- open `/{locale}/calendar`
- click empty cell and save reservation

5) Confirm cleaning created:
- open `/{locale}/cleanings`
- verify checkout cleaning exists

6) Switch language RO/RU/EN:
- use language switcher
- verify labels and pages

7) Create manager + assign properties:
- open `/{locale}/team`
- create/update manager and assign properties

8) Login manager and verify restricted view:
- `manager.test@example.com` / `Manager123!`
- cannot access Team/Superadmin
- sees only assigned properties and cleanings

9) Export CSV:
- from calendar top bar click `Export CSV`
- verify downloaded file columns:
  `propertyCode,propertyName,guestName,checkIn,checkOut,status,source`

