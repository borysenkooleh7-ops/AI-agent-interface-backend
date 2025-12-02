import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Super Administrator credentials
  const superAdmin = {
    email: 'admin@duxfit.com',
    password: 'DuxFit@2024!Super',
    name: 'Super Administrator',
    role: 'ADMIN' as const,
    status: 'ACTIVE' as const,
  };

  try {
    // Hash the password
    console.log('🔐 Hashing super admin password...');
    const hashedPassword = await bcrypt.hash(superAdmin.password, 10);

    // Create or update super admin (upsert for idempotency)
    console.log('👤 Creating super administrator...');
    const admin = await prisma.user.upsert({
      where: { email: superAdmin.email },
      update: {
        // Don't update if already exists
      },
      create: {
        email: superAdmin.email,
        password: hashedPassword,
        name: superAdmin.name,
        role: superAdmin.role,
        status: superAdmin.status,
      },
    });

    console.log('✅ Super administrator created successfully!\n');
    console.log('📋 Credentials:');
    console.log('   Email:', superAdmin.email);
    console.log('   Password:', superAdmin.password);
    console.log('   Role:', admin.role);
    console.log('   Status:', admin.status);
    console.log('   ID:', admin.id);
    console.log('\n⚠️  IMPORTANT: Save these credentials securely!\n');

    // Create DuxFit gym
    console.log('🏋️  Creating DuxFit gym...');
    const duxfitGym = await prisma.gym.upsert({
      where: { slug: 'duxfit-piaui-1' },
      update: {},
      create: {
        name: 'DuxFit - Piauí 1',
        slug: 'duxfit-piaui-1',
        address: 'Avenida Frei Serafim, 2850',
        city: 'Teresina',
        state: 'PI',
        zipCode: '64000-000',
        phone: '+55 (86) 99123-4567',
        email: 'duxfitacademia@gmail.com',
        status: 'ACTIVE',
        settings: {
          website: 'https://duxfit.com.br',
          instagram: '@duxfit',
          size: 3000,
          equipmentBrand: 'Speedo',
          capacity: 500,
          description: 'DuxFit is the biggest gym in Piauí, offering state-of-the-art equipment and facilities for all fitness levels.',
          timezone: 'America/Fortaleza',
          operatingHours: {
            monday: { enabled: true, open: '00:00', close: '23:59', is24h: true },
            tuesday: { enabled: true, open: '00:00', close: '23:59', is24h: true },
            wednesday: { enabled: true, open: '00:00', close: '23:59', is24h: true },
            thursday: { enabled: true, open: '00:00', close: '23:59', is24h: true },
            friday: { enabled: true, open: '00:00', close: '23:59', is24h: true },
            saturday: { enabled: true, open: '07:00', close: '19:00', is24h: false },
            sunday: { enabled: true, open: '07:00', close: '19:00', is24h: false }
          },
          primaryColor: '#8b5cf6',
          secondaryColor: '#6366f1'
        }
      }
    });

    console.log('✅ DuxFit gym created successfully!');
    console.log('   Name:', duxfitGym.name);
    console.log('   Slug:', duxfitGym.slug);
    console.log('   ID:', duxfitGym.id);
    console.log('');

    // Create AI Prompt for DuxFit
    console.log('🤖 Creating AI Prompt for DuxFit...');
    await prisma.aIPrompt.upsert({
      where: { gymId: duxfitGym.id },
      update: {},
      create: {
        gymId: duxfitGym.id,
        systemPrompt: `You are an AI sales assistant for DuxFit - Piauí 1, the biggest gym in Piauí, Brazil.

Your Objective:
- Provide friendly, persuasive customer service
- Qualify leads by collecting required information
- Answer questions about plans, pricing, and facilities
- Handle objections professionally
- Guide customers toward registration

Your Tone:
- Friendly and energetic
- Confident but not pushy
- Use emojis appropriately (💪🔥👏)
- Professional yet approachable

Gym Information:
- Name: DuxFit - Piauí 1
- Location: Av. Frei Serafim, 2850, Teresina, PI
- Size: 3,000m²
- Equipment: Speedo (international brand)

Our Plans:
- Annual Plan: R$99.99/month (Best value!)
- Semi-Annual: R$119.99/month
- Monthly: R$139.99/month
- Daily Pass: R$40.00/day

Operating Hours:
- Monday-Friday: 24 hours
- Saturday-Sunday: 7 AM - 7 PM

Required Information to Collect:
- Full Name
- CPF
- Date of Birth
- Address + ZIP Code
- Preferred Workout Time
- Fitness Goal
- Email Address

When to Escalate to Human:
- Billing disputes or refunds
- Cancellation requests
- HR or employment questions
- Complex technical issues
- Customer insists on speaking to human

Redirect Rules:
- For unlisted inquiries → Instagram @duxfit
- For resumes/jobs → duxfitacademia@gmail.com`,
        
        greetingMessage: "🎉 Hello! Welcome to DuxFit, the BIGGEST gym in Piauí! 💪🔥\n\nI'm here to help you achieve your fitness goals. How can I assist you today?",
        
        qualificationFlow: {
          steps: [
            { field: "name", question: "To get started, what's your full name?", required: true },
            { field: "cpf", question: "Great! And what's your CPF for registration?", required: true, validation: "cpf" },
            { field: "birthDate", question: "Perfect! What's your date of birth? (DD/MM/YYYY)", required: true, validation: "date" },
            { field: "goal", question: "Awesome! What's your main fitness goal?", required: true },
            { field: "preferredTime", question: "When do you prefer to work out?", required: false },
            { field: "email", question: "Last step! What's your email address?", required: true, validation: "email" }
          ]
        },
        
        objectionHandling: {
          objections: [
            {
              trigger: "I'll think about it|I need to think|let me think",
              response: "I totally understand! Taking time to think is smart. Just so you know, our pre-sale offer ends soon, and spots are filling up fast. Can I secure your spot with just R$9.99 for the first month while you decide?"
            },
            {
              trigger: "too expensive|can't afford|very expensive",
              response: "I totally understand your concern about pricing! We offer flexible options and the best value for our state-of-the-art facilities. Investing in your health now saves you money on medical bills later. Would you like me to discuss our flexible options?"
            },
            {
              trigger: "no time|don't have time|too busy",
              response: "I totally get it - life is busy! That's why we're open 24/5. You can work out at 5 AM, midnight, or whenever works for you. Even 20 minutes a day makes a difference. Would you like to start with a flexible schedule?"
            }
          ]
        },
        
        faqs: {
          questions: [
            {
              question: "What are your hours?",
              keywords: "hours|open|close|schedule|time",
              answer: "We're open 24/5! That's 24 hours on Monday-Friday, and 7 AM to 7 PM on weekends and holidays. You can work out whenever it fits your schedule! 🕐"
            },
            {
              question: "Do you have a kids room?",
              keywords: "kids|children|child|baby",
              answer: "Yes! Our DUX KIDS room welcomes children aged 2.5 to 10 years. It has a monitor and security cameras, and is open 6-9 AM and 4-9 PM. It's included FREE with all memberships! 👶"
            },
            {
              question: "What equipment do you have?",
              keywords: "equipment|machines|weights|cardio",
              answer: "We have top-of-the-line Speedo equipment across 3,000m²! That includes cardio machines, free weights, machines, and everything you need for a complete workout. 🏋️"
            },
            {
              question: "Do you have parking?",
              keywords: "parking|park|car",
              answer: "Yes! We have FREE parking for all members with security. 🚗"
            }
          ]
        },
        
        escalationRules: {
          keywords: {
            billing: ["refund", "charge", "payment issue", "double charged", "billing"],
            cancellation: ["cancel", "quit", "leave", "unsubscribe", "terminate"],
            hr: ["job", "work here", "hiring", "resume", "curriculum", "employment"],
            complex: ["speak to manager", "talk to human", "real person", "agent"]
          },
          actions: {
            billing: "transfer_to_billing",
            cancellation: "transfer_to_manager",
            hr: "redirect_to_email",
            complex: "transfer_to_agent"
          }
        }
      }
    });

    console.log('✅ AI Prompt created for DuxFit!');
    console.log('   System Prompt: Configured');
    console.log('   Greeting: Configured');
    console.log('   FAQs: 4 questions');
    console.log('   Objections: 3 handlers');
    console.log('');

    
   

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('✨ Database seeding completed successfully!');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Fatal error during seeding:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

