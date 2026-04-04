import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function generateCode(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function main() {
  const count = parseInt(process.argv[2] || "1", 10);
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = generateCode();
    await prisma.invitationCode.create({ data: { code } });
    codes.push(code);
  }

  console.log(`Generated ${count} invitation code(s):`);
  codes.forEach((c) => console.log(`  ${c}`));

  await prisma.$disconnect();
}

main().catch(console.error);
