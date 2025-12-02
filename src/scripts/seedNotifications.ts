import prisma from '../config/database';

async function seedNotifications() {
  try {
    console.log('🌱 Seeding sample notifications...');

    // Get the super admin user
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@duxfit.com' }
    });

    if (!adminUser) {
      console.error('❌ Admin user not found');
      return;
    }

    // Create sample notifications
    const notifications = await prisma.notification.createMany({
      data: [
        {
          userId: adminUser.id,
          type: 'NEW_LEAD',
          title: 'New lead: Maria Silva',
          message: 'A new lead from WhatsApp has been assigned to you',
          data: {
            source: 'WhatsApp',
            score: 85
          },
          read: false
        },
        {
          userId: adminUser.id,
          type: 'FOLLOW_UP_DUE',
          title: 'Follow-up due with João Santos',
          message: 'You have a scheduled call at 2:00 PM today',
          data: {
            type: 'CALL',
            scheduledAt: new Date().toISOString()
          },
          read: false
        },
        {
          userId: adminUser.id,
          type: 'LEAD_STATUS_CHANGE',
          title: 'Lead status changed: Ana Costa',
          message: 'Ana Costa moved from NEW to CONTACTED',
          data: {
            oldStatus: 'NEW',
            newStatus: 'CONTACTED'
          },
          read: false
        },
        {
          userId: adminUser.id,
          type: 'NEW_MESSAGE',
          title: 'New message from Pedro Lima',
          message: 'Olá! Gostaria de saber sobre os planos disponíveis',
          data: {
            channel: 'WhatsApp'
          },
          read: true
        },
        {
          userId: adminUser.id,
          type: 'SYSTEM_ALERT',
          title: '3 overdue follow-ups',
          message: 'You have 3 follow-ups that are past their due date',
          data: {
            count: 3
          },
          read: true
        }
      ]
    });

    console.log(`✅ Created ${notifications.count} sample notifications`);
    console.log('✅ Notification seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding notifications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedNotifications();

