package com.mailbridge.ai

import com.mailbridge.ai.data.ai.GeminiEmailAnalyzer
import com.mailbridge.ai.domain.DeadlineConfidence
import com.mailbridge.ai.domain.EmailPriority
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AiAnalysisParserTest {

    @Test
    fun parsesUrgentEmailWithExplicitDeadline() {
        val sample = """
            {
              "analysis": {
                "priority": "urgent",
                "summary": "Final exam room changed to B-204.",
                "reason": "Time-sensitive academic schedule change.",
                "action_required": "Confirm seat assignment on portal.",
                "deadline": "November 24, 2026 at 5:00 PM",
                "deadline_confidence": "explicit",
                "suggested_action": "Open the university portal."
              }
            }
        """.trimIndent()

        val result = GeminiEmailAnalyzer.parseStructuredResponse(sample)
        assertEquals(EmailPriority.URGENT, result.priority)
        assertEquals(DeadlineConfidence.EXPLICIT, result.deadlineConfidence)
        assertEquals("November 24, 2026 at 5:00 PM", result.deadline)
    }

    @Test
    fun handlesNullDeadlineWithoutFabrication() {
        val sample = """
            {
              "priority": "normal",
              "summary": "Monthly newsletter update.",
              "reason": "Informational digest.",
              "action_required": "No action required.",
              "deadline": null,
              "deadline_confidence": "none",
              "suggested_action": "Archive after reading."
            }
        """.trimIndent()

        val result = GeminiEmailAnalyzer.parseStructuredResponse(sample)
        assertEquals(EmailPriority.NORMAL, result.priority)
        assertEquals(DeadlineConfidence.NONE, result.deadlineConfidence)
        assertNull(result.deadline)
    }
}
