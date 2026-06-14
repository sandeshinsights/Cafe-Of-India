import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // First delete old codes (they have wrong settings)
  await prisma.promoCodeUsage.deleteMany();
  await prisma.promoCode.deleteMany();

  const codes = [
    { code: "WELCOME5", discountType: "PERCENTAGE", discountValue: 5, maxUsesPerCustomer: 1, orderNumber: 1, description: "5% off your 1st order" },
    { code: "WELCOME10", discountType: "PERCENTAGE", discountValue: 10, maxUsesPerCustomer: 1, orderNumber: 2, description: "10% off your 2nd order" },
    { code: "WELCOME15", discountType: "PERCENTAGE", discountValue: 15, maxUsesPerCustomer: 1, orderNumber: 3, description: "15% off your 3rd order" },
    { code: "WELCOME20", discountType: "PERCENTAGE", discountValue: 20, maxUsesPerCustomer: 1, orderNumber: 4, description: "20% off your 4th order" },
  ];

  for (const c of codes) {
    await prisma.promoCode.create({
      data: { code: c.code, discountType: c.discountType, discountValue: c.discountValue, maxUsesPerCustomer: c.maxUsesPerCustomer, orderNumber: c.orderNumber, description: c.description, active: true },
    });
    console.log(`Created: ${c.code} (order #${c.orderNumber})`);
  }

  console.log("Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());