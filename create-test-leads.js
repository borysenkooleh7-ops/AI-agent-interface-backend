const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestLeads() {
  try {
    console.log('🏋️  Getting gym ID...');
    const gym = await prisma.gym.findFirst();
    if (!gym) {
      console.error('❌ No gym found! Please run the seed script first.');
      return;
    }
    console.log('✅ Gym found:', gym.name, 'ID:', gym.id);

    console.log('👥 Creating test leads...');
    
    const testLeads = [
      {
        name: 'Maria Souza',
        phone: '+5586991234567',
        email: 'maria.souza@email.com',
        status: 'QUALIFIED',
        source: 'WHATSAPP',
        score: 85,
        notes: 'Very interested in annual plan. Wants to start next week.',
        gymId: gym.id,
      },
      {
        name: 'João Lima',
        phone: '+5586992345678',
        email: 'joao.lima@email.com',
        status: 'INTERESTED',
        source: 'INSTAGRAM',
        score: 70,
        notes: 'Asked about pricing and class schedules.',
        gymId: gym.id,
      },
      {
        name: 'Ana Pereira',
        phone: '+5586993456789',
        email: 'ana.pereira@email.com',
        status: 'NEW',
        source: 'WHATSAPP',
        score: 50,
        notes: 'First contact. Responded to pre-sale campaign.',
        gymId: gym.id,
      },
      {
        name: 'Carlos Santos',
        phone: '+5586994567890',
        email: 'carlos.santos@email.com',
        status: 'CLOSED',
        source: 'WEBSITE',
        score: 95,
        notes: 'Signed up for annual plan. Payment confirmed.',
        gymId: gym.id,
      },
      {
        name: 'Pedro Silva',
        phone: '+5586995678901',
        email: 'pedro.silva@email.com',
        status: 'NEW',
        source: 'WHATSAPP',
        score: 45,
        notes: 'Asking about gym location and opening hours.',
        gymId: gym.id,
      },
      {
        name: 'Fernanda Costa',
        phone: '+5586996789012',
        email: 'fernanda.costa@email.com',
        status: 'INTERESTED',
        source: 'INSTAGRAM',
        score: 65,
        notes: 'Interested in morning classes. Asked about personal training.',
        gymId: gym.id,
      },
      {
        name: 'Roberto Alves',
        phone: '+5586997890123',
        email: 'roberto.alves@email.com',
        status: 'QUALIFIED',
        source: 'WHATSAPP',
        score: 80,
        notes: 'Ready to join. Waiting for payment link.',
        gymId: gym.id,
      },
      {
        name: 'Juliana Pires',
        phone: '+5586998901234',
        email: 'juliana.pires@email.com',
        status: 'INACTIVE',
        source: 'WEBSITE',
        score: 30,
        notes: 'No response for 5 days. May need follow-up.',
        gymId: gym.id,
      },
      {
        name: 'Lucas Oliveira',
        phone: '+5586999012345',
        email: 'lucas.oliveira@email.com',
        status: 'QUALIFIED',
        source: 'REFERRAL',
        score: 90,
        notes: 'Referred by existing member. Very motivated.',
        gymId: gym.id,
      },
      {
        name: 'Patricia Mendes',
        phone: '+5586990123456',
        email: 'patricia.mendes@email.com',
        status: 'LOST',
        source: 'FACEBOOK',
        score: 20,
        notes: 'Chose competitor gym. Price was main factor.',
        gymId: gym.id,
      },
    ];

    let created = 0;
    for (const leadData of testLeads) {
      try {
        await prisma.lead.create({
          data: leadData,
        });
        created++;
        console.log(`✅ Created lead: ${leadData.name}`);
      } catch (error) {
        console.log(`⚠️  Lead ${leadData.name} may already exist, skipping...`);
      }
    }

    console.log(`\n🎉 Successfully created ${created} test leads!`);
    console.log('Status breakdown:');
    console.log('- NEW: 2 leads');
    console.log('- INTERESTED: 2 leads');
    console.log('- QUALIFIED: 3 leads');
    console.log('- CLOSED: 1 lead');
    console.log('- INACTIVE: 1 lead');
    console.log('- LOST: 1 lead');

  } catch (error) {
    console.error('❌ Error creating test leads:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestLeads();
