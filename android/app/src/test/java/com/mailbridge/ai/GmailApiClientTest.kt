package com.mailbridge.ai

import com.mailbridge.ai.data.gmail.GmailApiClient
import java.util.Base64
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class GmailApiClientTest {
    @Test fun readsProfileForAccountMatching() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("""{"emailAddress":"owner@example.test"}"""))
            val client = GmailApiClient(OkHttpClient(), server.url("users/me").toString().trimEnd('/'))
            assertEquals("owner@example.test", client.fetchEmailAddress("test-token").getOrThrow())
            val request = server.takeRequest()
            assertEquals("/users/me/profile", request.path)
            assertEquals("Bearer test-token", request.getHeader("Authorization"))
        }
    }

    @Test fun emptyMailboxIsSuccessful() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("""{"resultSizeEstimate":0}"""))
            val client = GmailApiClient(OkHttpClient(), server.url("users/me").toString().trimEnd('/'))
            assertTrue(client.fetchRecentMessages("test-token", 20).getOrThrow().isEmpty())
        }
    }

    @Test fun rejectedTokenIsAnErrorNotAnEmptyInbox() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setResponseCode(401))
            val client = GmailApiClient(OkHttpClient(), server.url("users/me").toString().trimEnd('/'))
            val result = client.fetchRecentMessages("expired-token", 20)
            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull()!!.message!!.contains("reconnect"))
        }
    }

    @Test fun parsesBareSenderAndMultipartUnicodeBody() {
        val body = Base64.getUrlEncoder().withoutPadding().encodeToString("Hello Jonathan — welcome".toByteArray())
        val message = JSONObject("""{
          "id":"123abc", "threadId":"thread1", "internalDate":"0", "labelIds":["INBOX","UNREAD"],
          "snippet":"short preview", "payload":{"mimeType":"multipart/alternative",
          "headers":[{"name":"From","value":"owner@example.test"},{"name":"Subject","value":"Welcome"}],
          "parts":[{"mimeType":"text/plain","body":{"data":"$body"}}]}}
        """)
        val result = GmailApiClient.parseMessage(message)
        assertEquals("owner@example.test", result.senderEmail)
        assertEquals("Hello Jonathan — welcome", result.bodyText)
        assertEquals("1970-01-01T00:00:00Z", result.receivedAtIso)
        assertTrue(result.isUnread)
    }

    @Test fun doesNotReadTextAttachmentsAsTheMessageBody() {
        val body = Base64.getUrlEncoder().encodeToString("private attachment".toByteArray())
        val result = GmailApiClient.parseMessage(JSONObject("""{
          "id":"123abc", "snippet":"preview", "payload":{"parts":[
          {"mimeType":"text/plain","filename":"notes.txt","body":{"data":"$body"}}]}}
        """))
        assertEquals("preview", result.bodyText)
        assertEquals("(No subject)", result.subject)
        assertFalse(result.isUnread)
    }
}
