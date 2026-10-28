package expo.modules.cameranetwork

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.*
import java.util.concurrent.ConcurrentHashMap

class CameraNetworkModule : Module() {
  @Volatile private var network: Network? = null
  private val jobs = ConcurrentHashMap<String, AutoCloseable>()
  private val cm get() = appContext.reactContext!!.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

  override fun definition() = ModuleDefinition {
    Name("CameraNetwork")
    Function("cancel") { id: String -> jobs.remove(id)?.close() }
    Function("release") { release() }
    OnDestroy { release() }
    AsyncFunction("discover") { id: String -> discover(id) }
    AsyncFunction("request") { id: String, url: String, method: String, body: String, timeout: Int ->
      val selected = network ?: throw IllegalStateException("Vuelve a buscar la cámara para seleccionar su red Wi-Fi.")
      check(cm.getNetworkCapabilities(selected)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true) { "Se perdió el Wi-Fi de la cámara. Vuelve a conectar." }
      val uri = URI(url)
      require(uri.scheme == "http" && uri.host.matches(Regex("[0-9.]+")) && InetAddress.getByName(uri.host).isSiteLocalAddress) { "Dirección local inválida" }
      val connection = selected.openConnection(uri.toURL()) as HttpURLConnection
      jobs[id] = AutoCloseable { connection.disconnect() }
      try {
        connection.connectTimeout = timeout
        connection.readTimeout = timeout
        connection.instanceFollowRedirects = false
        connection.requestMethod = method
        connection.setRequestProperty("Connection", "close")
        if (body.isNotEmpty()) {
          connection.doOutput = true
          connection.setRequestProperty("Content-Type", "application/json")
          connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        }
        check(connection.responseCode in 200..299) { "El servicio respondió HTTP ${connection.responseCode}." }
        connection.inputStream.use {
          val output = java.io.ByteArrayOutputStream()
          val buffer = ByteArray(4096)
          while (output.size() <= 262144) {
            val count = it.read(buffer)
            if (count < 0) break
            output.write(buffer, 0, count)
          }
          val bytes = output.toByteArray()
          check(bytes.size <= 262144) { "Respuesta demasiado grande" }
          String(bytes, Charsets.UTF_8)
        }
      } finally { jobs.remove(id); connection.disconnect() }
    }
  }

  private fun release() {
    jobs.values.forEach { try { it.close() } catch (_: Exception) {} }
    jobs.clear()
    network = null
  }

  private fun discover(id: String): Map<String, Any> {
    val wifi = cm.allNetworks.filter { cm.getNetworkCapabilities(it)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true }
    check(wifi.size == 1) { if (wifi.isEmpty()) "No hay una red Wi-Fi conectada. Únete al Wi-Fi de la Sony y acepta mantenerla sin internet." else "Hay varias redes Wi-Fi activas. Desactiva las conexiones simultáneas y vuelve a buscar." }
    val selected = wifi.single()
    network = selected
    val links = cm.getLinkProperties(selected) ?: error("El Wi-Fi aún no tiene configuración de red.")
    val address = links.linkAddresses.map { it.address }.filterIsInstance<Inet4Address>().firstOrNull()
      ?: error("El Wi-Fi aún no tiene dirección IPv4. Espera y vuelve a buscar.")
    val iface = NetworkInterface.getByName(links.interfaceName) ?: error("No se encontró la interfaz Wi-Fi.")
    val manager = appContext.reactContext!!.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    val lock = manager.createMulticastLock("SonyRecipeDiscovery").apply { setReferenceCounted(false) }
    val socket = MulticastSocket(null)
    jobs[id] = AutoCloseable { socket.close() }
    val replies = mutableListOf<Map<String, String>>()
    try {
      selected.bindSocket(socket)
      socket.bind(InetSocketAddress(address, 0))
      socket.networkInterface = iface
      socket.timeToLive = 2
      socket.soTimeout = 400
      lock.acquire()
      val end = System.nanoTime() + 6_500_000_000L
      var next = 0L
      while (System.nanoTime() < end && replies.size < 64) {
        check(!socket.isClosed) { "Búsqueda cancelada." }
        val now = System.nanoTime()
        if (now >= next) {
          for (target in listOf("urn:schemas-sony-com:service:ScalarWebAPI:1", "ssdp:all")) {
            val bytes = "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: $target\r\n\r\n".toByteArray()
            socket.send(DatagramPacket(bytes, bytes.size, InetAddress.getByName("239.255.255.250"), 1900))
          }
          next = now + 2_000_000_000L
        }
        try {
          val packet = DatagramPacket(ByteArray(16385), 16385)
          socket.receive(packet)
          if (packet.length <= 16384) replies.add(mapOf("message" to String(packet.data, 0, packet.length, Charsets.UTF_8), "address" to packet.address.hostAddress!!))
        } catch (_: SocketTimeoutException) {}
      }
      return mapOf("replies" to replies, "diagnostics" to listOf("Wi-Fi: ${iface.name} · IPv4 ${address.hostAddress}", "SSDP: ${replies.size} respuestas recibidas por Wi-Fi"))
    } finally {
      jobs.remove(id)
      socket.close()
      if (lock.isHeld) lock.release()
    }
  }
}
