# WhatsApp Message Sending Flow Diagram

This document explains how the system sends messages to users via WhatsApp Business API.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WHATSAPP MESSAGE SENDING FLOW                        │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   Frontend   │
│  (React App) │
└──────┬───────┘
       │
       │ 1. User types message & clicks "Send"
       │    POST /api/conversations/:id/messages
       │    OR
       │    POST /api/whatsapp/send
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Backend API Layer                                 │
│  ┌────────────────────────┐  ┌──────────────────────────┐         │
│  │ Conversation Controller│  │ WhatsApp Controller       │         │
│  │ /conversations/:id/    │  │ /whatsapp/send           │         │
│  │ messages               │  │                          │         │
│  └──────────┬─────────────┘  └──────────┬───────────────┘         │
│             │                           │                          │
│             │ 2. Validate request        │ 2. Validate request       │
│             │    - Check auth token     │    - Check auth token     │
│             │    - Validate params      │    - Validate params      │
│             │                           │    - Check gymId          │
│             │                           │                           │
└─────────────┼───────────────────────────┼───────────────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────────┐  ┌──────────────────────────────┐
│  Conversation Service       │  │  WhatsApp Service            │
│  conversation.service.ts     │  │  whatsapp.service.ts         │
│                             │  │                              │
│  3. Save message to DB      │  │  3. Get WhatsApp config      │
│     - Create Message record │  │     - Fetch from DB          │
│     - Update conversation   │  │     - Get accessToken         │
│     - Log activity          │  │     - Get phoneNumberId      │
│                             │  │                              │
│  4. Emit Socket.IO event    │  │  4. Prepare message payload  │
│     - message:new           │  │     - Format for WhatsApp    │
│                             │  │     - Add messaging_product  │
│  ⚠️ NOTE: Currently does    │  │                              │
│     NOT send via WhatsApp!  │  │  5. Call WhatsApp API        │
│                             │  │     POST to Meta Graph API   │
└─────────────────────────────┘  └──────────┬───────────────────┘
                                              │
                                              │ 6. HTTP POST Request
                                              │    URL: https://graph.facebook.com
                                              │         /v21.0/{phoneNumberId}/messages
                                              │    Headers:
                                              │      Authorization: Bearer {accessToken}
                                              │      Content-Type: application/json
                                              │    Body:
                                              │      {
                                              │        messaging_product: "whatsapp",
                                              │        to: "+5511999999999",
                                              │        type: "text",
                                              │        text: { body: "Hello!" }
                                              │      }
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Meta WhatsApp Business API                        │
│  (Facebook Graph API)                                               │
│                                                                      │
│  7. Validate request                                                │
│     - Check access token                                             │
│     - Verify phone number ID                                         │
│     - Validate message format                                        │
│                                                                      │
│  8. Send message to WhatsApp                                        │
│     - Queue message for delivery                                     │
│     - Return message ID (wamid)                                      │
│                                                                      │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       │ 9. HTTP 200 Response
                       │    {
                       │      messaging_product: "whatsapp",
                       │      contacts: [{ input: "+5511999999999", wa_id: "..." }],
                       │      messages: [{ id: "wamid.xxx" }]
                       │    }
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Backend Response Handling                        │
│                                                                      │
│  10. Log success                                                    │
│      - Log message activity                                          │
│      - Store WhatsApp message ID in metadata                        │
│                                                                      │
│  11. Return response to frontend                                    │
│      - Success status                                               │
│      - Message ID                                                   │
│                                                                      │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       │ 12. HTTP 200 Response
                       │     { success: true, data: {...} }
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Frontend Updates                                 │
│                                                                      │
│  13. Update UI                                                      │
│      - Add message to conversation view                              │
│      - Show success toast                                            │
│      - Clear input field                                             │
│                                                                      │
│  14. Real-time updates (Socket.IO)                                 │
│      - Other connected clients receive message:new event             │
│      - Conversation view updates in real-time                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                       │
                       │ 15. Message delivered to user's WhatsApp
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    User's WhatsApp App                              │
│                                                                      │
│  User receives message on their phone                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Detailed Component Flow

### 1. Direct WhatsApp Sending (via `/api/whatsapp/send`)

**Route:** `POST /api/whatsapp/send`

**Flow:**
```
Frontend → WhatsAppController.sendTextMessage()
         → WhatsAppService.sendTextMessage()
         → WhatsAppService.sendMessage() [private]
         → Meta Graph API
         → Response back to frontend
```

**Request Body:**
```json
{
  "to": "+5511999999999",
  "message": "Hello, this is a test message",
  "gymId": "gym-id-here"
}
```

**Steps:**
1. Controller validates `to`, `message`, and `gymId`
2. Service gets WhatsApp config from database (accessToken, phoneNumberId)
3. Service formats message for WhatsApp API
4. Service makes POST request to Meta Graph API
5. Service logs activity
6. Response returned to frontend

### 2. Conversation Message Sending (via `/api/conversations/:id/messages`)

**Route:** `POST /api/conversations/:id/messages`

**Current Flow:**
```
Frontend → ConversationController.sendMessage()
         → ConversationService.sendMessage()
         → Save to Database
         → Emit Socket.IO event
         → Response back to frontend
```

**⚠️ IMPORTANT:** Currently, this flow **DOES NOT** send messages via WhatsApp. It only:
- Saves the message to the database
- Updates the conversation
- Emits real-time events via Socket.IO

**To actually send via WhatsApp, you would need to:**
1. Check if conversation channel is 'whatsapp'
2. Get lead's phone number from conversation
3. Get gymId from conversation/lead
4. Call `whatsappService.sendTextMessage()` after saving to DB

**Request Body:**
```json
{
  "content": "Hello, this is a test message",
  "sender": "AGENT",
  "type": "TEXT"
}
```

## WhatsApp API Request Details

### Endpoint
```
POST https://graph.facebook.com/v21.0/{phoneNumberId}/messages
```

### Headers
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

### Request Body (Text Message)
```json
{
  "messaging_product": "whatsapp",
  "to": "+5511999999999",
  "type": "text",
  "text": {
    "body": "Your message content here"
  }
}
```

### Response
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "+5511999999999",
      "wa_id": "5511999999999"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgNNTUxMTk5OTk5OTk5OTk5FQIAERgSQjY4NkU2M0E3QzU5QzQ4QkUAA=="
    }
  ]
}
```

## Database Storage

### Message Record
When a message is sent:
1. **Message table:** Stores the message content, type, sender, conversationId
2. **Metadata field:** Can store WhatsApp message ID (wamid) for tracking
3. **Activity Log:** Records MESSAGE_SENT activity if sent by AGENT

### WhatsApp Config
Stored in `WhatsAppAccount` table:
- `accessToken`: Permanent token for API access
- `phoneNumberId`: Meta phone number ID
- `phoneNumber`: Business phone number
- `gymId`: Associated gym

## Real-time Updates

### Socket.IO Events

**When message is sent:**
- Event: `message:new`
- Room: `conversation:{conversationId}`
- Payload: Full message object

**Clients listening:**
- All users viewing that conversation
- Assigned agent (if conversation has userId)

## Error Handling

### Common Errors

1. **401 Unauthorized**
   - Invalid or expired access token
   - Solution: Regenerate token in Meta Business Manager

2. **400 Bad Request**
   - Invalid phone number format
   - Missing required fields
   - Solution: Validate phone number (E.164 format: +5511999999999)

3. **403 Forbidden**
   - Phone number not registered
   - Insufficient permissions
   - Solution: Verify phone number in Meta Business Manager

4. **429 Too Many Requests**
   - Rate limit exceeded
   - Solution: Implement rate limiting/retry logic

## Message Types Supported

1. **Text Messages**
   - Simple text content
   - Max 4096 characters

2. **Media Messages**
   - Image (with optional caption)
   - Document (with optional caption and filename)
   - Audio
   - Video (with optional caption)

## 24-Hour Messaging Window

**Important:** Meta only allows sending messages to users who:
- Have messaged you within the last 24 hours, OR
- You're sending an approved template message

**Outside 24-hour window:**
- Must use approved message templates
- Template must be approved by Meta
- Limited to specific use cases

## Integration Points

### Frontend Components
- `ConversationView.tsx`: Main conversation interface
- `conversationService.ts`: API service for conversations
- Socket.IO hooks: Real-time message updates

### Backend Services
- `whatsapp.service.ts`: Core WhatsApp API integration
- `conversation.service.ts`: Conversation management
- `socketManager.ts`: Socket.IO instance management

### Controllers
- `whatsapp.controller.ts`: Direct WhatsApp sending
- `conversation.controller.ts`: Conversation message handling

## Future Improvements

1. **Integrate WhatsApp sending into conversation flow**
   - When agent sends message in conversation, also send via WhatsApp
   - Check conversation channel before sending

2. **Message status tracking**
   - Track delivery status (sent, delivered, read)
   - Update UI based on status

3. **Template message support**
   - Allow sending approved templates
   - Handle template parameters

4. **Media upload support**
   - Upload media files to WhatsApp
   - Send media messages from conversations

