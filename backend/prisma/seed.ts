import { PrismaClient } from "@prisma/client";
import { hashPin } from "../src/utils/pin.js";

const prisma = new PrismaClient();

async function main() {
  const pinHash = await hashPin("1234");

  await prisma.user.upsert({
    where: { code: "000000" },
    update: {
      name: "Admin",
      role: "ADMIN",
      pinHash,
      isActive: true,
      isBlocked: false,
      failedLoginAttempts: 0
    },
    create: {
      code: "000000",
      name: "Admin",
      role: "ADMIN",
      pinHash,
      dailyMinutesExpected: 480,
      workSchedule: "MON_FRI"
    }
  });

  await prisma.companySettings.upsert({
    where: { id: "company" },
    update: {},
    create: {
      id: "company",
      legalName: "",
      cnpj: "",
      address: ""
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
