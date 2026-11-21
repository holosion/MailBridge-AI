package com.mailbridge.ai.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val MailBridgeBlue = Color(0xFF174EA6)
val MailBridgeCyan = Color(0xFF00BCD4)
val LightCanvas = Color(0xFFF5F7FB)
val DarkCanvas = Color(0xFF0B1120)
val DarkSurface = Color(0xFF111827)

private val LightColors = lightColorScheme(
    primary = MailBridgeBlue,
    onPrimary = Color.White,
    secondary = MailBridgeCyan,
    onSecondary = Color(0xFF06202A),
    background = LightCanvas,
    onBackground = Color(0xFF0F172A),
    surface = Color.White,
    onSurface = Color(0xFF0F172A)
)

private val DarkColors = darkColorScheme(
    primary = MailBridgeCyan,
    onPrimary = Color(0xFF06202A),
    secondary = MailBridgeBlue,
    onSecondary = Color.White,
    background = DarkCanvas,
    onBackground = Color(0xFFF1F5F9),
    surface = DarkSurface,
    onSurface = Color(0xFFF1F5F9)
)

@Composable
fun MailBridgeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}
