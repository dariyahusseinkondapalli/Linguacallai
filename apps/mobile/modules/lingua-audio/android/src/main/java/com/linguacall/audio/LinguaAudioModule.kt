package com.linguacall.audio

import android.content.Context
import android.media.*
import android.media.audiofx.NoiseSuppressor
import android.media.audiofx.AcousticEchoCanceler
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LinguaAudioModule : Module() {
  private val audio get() = appContext.reactContext!!.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private var callback: AudioDeviceCallback? = null
  private var focus: AudioFocusRequest? = null
  private var legacyFocus: AudioManager.OnAudioFocusChangeListener? = null
  private var previousMode: Int? = null
  private var suppression: NoiseSuppressor? = null
  private var cancellation: AcousticEchoCanceler? = null
  private var recordingCallback: AudioManager.AudioRecordingCallback? = null
  private var effectSession = 0
  @Synchronized
  private fun updateEffects(configs: List<AudioRecordingConfiguration>) {
    if(recordingCallback == null) return
    // Android redacts other apps' session IDs to zero without privileged permission.
    val session = configs.firstOrNull { it.clientAudioSessionId > 0 }?.clientAudioSessionId ?: 0
    if(session == effectSession) return
    suppression?.release(); cancellation?.release(); suppression = null; cancellation = null
    effectSession = session
    if(session > 0) {
      try { if(NoiseSuppressor.isAvailable()) suppression = NoiseSuppressor.create(session)?.apply { enabled = true } } catch (_: Exception) {}
      try { if(AcousticEchoCanceler.isAvailable()) cancellation = AcousticEchoCanceler.create(session)?.apply { enabled = true } } catch (_: Exception) {}
    }
    sendEvent("effectsChanged", snapshot())
  }
  override fun definition() = ModuleDefinition {
    Name("LinguaAudio")
    Events("routeChanged", "focusLost", "effectsChanged")
    OnStartObserving {
      val listener = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(devices: Array<out AudioDeviceInfo>) { sendEvent("routeChanged", snapshot()) }
        override fun onAudioDevicesRemoved(devices: Array<out AudioDeviceInfo>) { sendEvent("routeChanged", snapshot()) }
      }
      callback = listener
      audio.registerAudioDeviceCallback(listener, Handler(Looper.getMainLooper()))
    }
    OnStopObserving { callback?.let { audio.unregisterAudioDeviceCallback(it) }; callback = null }
    Function("snapshot") { snapshot() }
    Function("enhanceCapture") {
      if(recordingCallback == null) {
        val listener = object : AudioManager.AudioRecordingCallback() {
          override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>) { updateEffects(configs) }
        }
        recordingCallback = listener
        audio.registerAudioRecordingCallback(listener, Handler(Looper.getMainLooper()))
      }
      updateEffects(audio.activeRecordingConfigurations)
    }
    Function("selectOutput") { id: Int ->
      if (Build.VERSION.SDK_INT < 31) throw IllegalStateException("Choose the audio output in Android system settings on this version")
      val device = audio.availableCommunicationDevices.firstOrNull { it.id == id } ?: throw IllegalArgumentException("Device disconnected")
      if (previousMode == null) previousMode = audio.mode
      audio.mode = AudioManager.MODE_IN_COMMUNICATION
      audio.setCommunicationDevice(device)
    }
    Function("beginCall") {
      if (previousMode == null) previousMode = audio.mode
      audio.mode = AudioManager.MODE_IN_COMMUNICATION
    }
    Function("acquireFocus") {
      if (previousMode == null) previousMode = audio.mode
      val listener = AudioManager.OnAudioFocusChangeListener { change -> if(change < 0) sendEvent("focusLost", mapOf("reason" to "Audio focus interrupted")) }
      if(Build.VERSION.SDK_INT >= 26) {
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
          .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
          .setOnAudioFocusChangeListener(listener).build()
        focus = request
        audio.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
      } else {
        legacyFocus = listener
        audio.requestAudioFocus(listener, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
      }
    }
    Function("release") { release() }
    OnDestroy { release() }
  }
  @Synchronized
  private fun release() {
    recordingCallback?.let { audio.unregisterAudioRecordingCallback(it) }; recordingCallback = null
    suppression?.release(); cancellation?.release(); suppression = null; cancellation = null; effectSession = 0
    if(Build.VERSION.SDK_INT >= 26) focus?.let { audio.abandonAudioFocusRequest(it) }; focus = null
    legacyFocus?.let { audio.abandonAudioFocus(it) }; legacyFocus = null
    if (Build.VERSION.SDK_INT >= 31) audio.clearCommunicationDevice()
    previousMode?.let { audio.mode = it }; previousMode = null
  }
  @Synchronized
  private fun snapshot(): Map<String, Any?> {
    val devices = if(Build.VERSION.SDK_INT >= 31) audio.availableCommunicationDevices else audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).toList()
    return mapOf(
      "outputs" to devices.map { mapOf("id" to it.id, "name" to it.productName.toString(), "type" to it.type) },
      "selected" to if(Build.VERSION.SDK_INT >= 31) audio.communicationDevice?.id else null,
      "canSelect" to (Build.VERSION.SDK_INT >= 31),
      "noiseSuppressionAvailable" to NoiseSuppressor.isAvailable(),
      "echoCancellationAvailable" to AcousticEchoCanceler.isAvailable(),
      "effectsActive" to (suppression?.enabled == true),
      "echoCancellationActive" to (cancellation?.enabled == true)
    )
  }
}
