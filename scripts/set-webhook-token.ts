import prisma from '../src/config/database';
import * as whatsappMetaConfigService from '../src/services/whatsappMetaConfig.service';

/**
 * Script to set the WhatsApp webhook verify token
 * Usage: npx ts-node scripts/set-webhook-token.ts <token>
 */
async function setWebhookToken() {
  const token = process.argv[2];

  if (!token) {
    console.error('❌ Error: Please provide a webhook verify token');
    console.log('Usage: npx ts-node scripts/set-webhook-token.ts <token>');
    process.exit(1);
  }

  try {
    console.log('🔄 Setting webhook verify token...');
    
    await whatsappMetaConfigService.updateWhatsAppMetaConfig({
      webhookVerifyToken: token
    }, 'script');

    console.log('✅ Webhook verify token set successfully!');
    console.log(`   Token: ${token.substring(0, 10)}...`);
    
    // Verify it was set
    const { getWebhookVerifyToken } = await import('../src/services/whatsappMetaConfig.service');
    const retrievedToken = await getWebhookVerifyToken();
    
    if (retrievedToken === token) {
      console.log('✅ Verification: Token matches!');
    } else {
      console.error('❌ Warning: Retrieved token does not match!');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error setting webhook token:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setWebhookToken();

