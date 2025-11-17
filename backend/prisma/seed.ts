const { PrismaClient } = require("@prisma/client");
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(
    "password123",
    Number(process.env.BCRYPT_COST || 10),
  );

  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: {
      email: "owner@example.com",
      name: "Owner User",
      passwordHash: hash,
    },
  });

  let company = await prisma.company.findFirst({
    where: { name: "Acme Corp" },
  });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "Acme Corp",
        memberships: {
          create: { userId: owner.id, role: "OWNER" },
        },
      },
    });
  }

  await prisma.user.update({
    where: { id: owner.id },
    data: { activeCompanyId: company.id },
  });

  await prisma.invite.upsert({
    where: { token: "seed-token" },
    update: {
      companyId: company.id,
      email: "member@example.com",
      role: "MEMBER",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    create: {
      companyId: company.id,
      email: "member@example.com",
      role: "MEMBER",
      token: "seed-token",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("Seed complete");
}

main().finally(() => prisma.$disconnect());
