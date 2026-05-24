INSERT INTO "User" (
  "id",
  "code",
  "name",
  "role",
  "pinHash",
  "dailyMinutesExpected",
  "workSchedule",
  "isActive",
  "isBlocked",
  "failedLoginAttempts",
  "createdAt",
  "updatedAt"
) VALUES (
  'user_admin_000000',
  '000000',
  'Admin',
  'ADMIN'::"Role",
  'pbkdf2_sha256$310000$0xk2+O9N44psv0nNGejCaA==$ii2YskXctOB0By60KTkivxYXaiq/pFwgkr+mWCD4nWg=',
  480,
  'MON_FRI'::"WorkSchedule",
  true,
  false,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "pinHash" = EXCLUDED."pinHash",
  "dailyMinutesExpected" = EXCLUDED."dailyMinutesExpected",
  "workSchedule" = EXCLUDED."workSchedule",
  "isActive" = true,
  "isBlocked" = false,
  "failedLoginAttempts" = 0,
  "updatedAt" = NOW();

INSERT INTO "CompanySettings" (
  "id",
  "legalName",
  "cnpj",
  "address",
  "updatedAt"
) VALUES (
  'company',
  '',
  '',
  '',
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
