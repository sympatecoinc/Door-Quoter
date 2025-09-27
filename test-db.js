const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log('Database connection successful');

    // Try a simple query
    const customerCount = await prisma.customer.count();
    console.log(`Found ${customerCount} customers in database`);

  } catch (error) {
    console.log('Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();