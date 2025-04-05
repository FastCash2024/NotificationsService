import fetch from "node-fetch";
import { SmsModel } from "../models/smsModel.js";
import { generateRandomCode } from "../utilities/generateCode.js";
import { SmsSendModel } from "../models/SmsCollection.js";
import { toHex } from "../utilities/sms.js";

const checkUniqueCode = async (SmsModel, code) => {
  const existingCode = await SmsModel.findOne({ code });
  if (existingCode) {
    return checkUniqueCode(SmsModel, generateRandomCode());
  }
  return code;
};

const saveOtpLog = async (telefono, code) => {
  const newSMS = new SmsModel({ telefono, code });
  await newSMS.save();
}

const sendOTPProvider = async (telefono, code) => {
  try {

    const message = `Tu codigo de verificacion para FastCash es: ${code}`;
    const encryptedMessage = toHex(message);

    const smsPayload = {
      message: encryptedMessage,
      phones: telefono,
      senderid: "80089",
      pwd: "DMr1CPxO",
      spid: "ROCLAUMXOTP",
    };

    const response = await fetch("http://94.74.64.43:8811/sms/send/v3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(smsPayload),
    });

    const data = await response.json();

    return {
      success: data.status === "0",
      responseData: data.results,
      error: data.status !== "0" ? data.desc || "Error desconocido" : null,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const sendSMSOtp = async (req, res) => {
  const { telefono } = req.body;
  if (!telefono) {
    return res.status(400).json({
      error: "Número de destinatario es requerido.",
    });
  }
  try {
    const code = await checkUniqueCode(SmsModel, generateRandomCode());
    const { success, error, responseData } = await sendOTPProvider(telefono, code);

    if (!success) {
      return res.status(500).json({ error: "Error al enviar el OTP", details: error })
    }

    await saveOtpLog(telefono, code);

    return res.status(200).json({
      message: "OTP enviado exitosamente",
      code: code,
      data: responseData,
    })
  } catch (error) {
    res.status(500).json({
      error: "Error al enviar Otp",
      details: error.message,
    });
  }
};

export const getSmsLogs = async (req, res) => {
  try {
    const { remitente, receptor, limit = 10, page = 1 } = req.query;

    const filter = {};
    if (remitente) {
      filter.remitenteDeSms = { $regex: remitente, $options: "i" };
    }
    if (receptor) {
      filter.numeroDeTelefonoMovil = { $regex: receptor, $options: "i" };
    }

    // Convertir y validar limit y page
    const limitInt = parseInt(limit, 10);
    const pageInt = parseInt(page, 10);
    if (isNaN(limitInt) || limitInt <= 0) return res.status(400).json({ message: "Limit debe ser un número mayor a 0." });
    if (isNaN(pageInt) || pageInt <= 0) return res.status(400).json({ message: "Page debe ser un número mayor a 0." });

    const skip = (pageInt - 1) * limitInt;

    // Aplicar el filtro correctamente
    const smsLogs = await SmsSendModel.find(filter)
      .sort({ _id: -1 })
      .limit(limitInt)
      .skip(skip);

    // Formatear la fecha de envío
    const formattedLogs = smsLogs.map(log => {
      const fecha = new Date(log.fechaDeEnvio);
      return {
        ...log.toObject(),
        fechaDeEnvio: !isNaN(fecha.getTime()) ? fecha.toISOString().split('T')[0] : log.fechaDeEnvio,
      };
    });

    // Obtener el total de documentos aplicando el filtro
    const totalDocuments = await SmsSendModel.countDocuments(filter);

    // Calcular total de páginas
    const totalPages = Math.ceil(totalDocuments / limitInt);

    res.json({
      data: formattedLogs,
      currentPage: pageInt,
      totalPages,
      totalDocuments,
    });
  } catch (error) {
    console.error("Error al obtener los registros de SMS:", error);
    res.status(500).json({ message: "Error al obtener los registros de SMS." });
  }
};

export const verificarOTP = async (req, res) => {
  try {
    const { telefono, codigo } = req.body;

    if (!telefono || !codigo) {
      return res.status(400).json({ error: "El número de teléfono y el código OTP son requeridos." });
    }

    const otpRecord = await SmsModel.findOne({ telefono, code: codigo });

    if (!otpRecord) {
      const phoneExists = await SmsModel.findOne({ telefono });
      if (phoneExists) {
        return res.status(400).json({ error: "El código es incorrecto." });
      }
      return res.status(404).json({ error: "El número de teléfono no está registrado o no tiene un OTP válido." });
    }

    return res.status(200).json({ message: "Verificación realizada correctamente." });

  } catch (error) {
    res.status(500).json({ error: "Ocurrió un error al verificar el OTP.", details: error.message });
  }
};

const sendSMSProvider = async (telefono, message) => {
  try {
    const response = await fetch("http://94.74.64.43:8811/sms/send/v3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spid: "ROCLAUMXYX",
        pwd: "QYpjy9Zz",
        phones: telefono,
        message,
        senderid: "80838",
      }),
    });

    const data = await response.json();
    
    const success = data.status === "0";
    const error = success ? null : `Error en envío: ${data.desc || "Desconocido"}`;

    return { success, error }

  } catch (error) {
    return { success: false, error: error.message }
  }
}

const saveSMSLog = async (telefono, message, estado, remitenteDeSms, codigoDeProducto, producto) => {
  const newSMS = new SmsSendModel({
    numeroDeTelefonoMovil: telefono,
    contenido: message,
    canalDeEnvio: "SMS",
    remitenteDeSms,
    codigoDeProducto,
    producto,
    fechaDeEnvio: new Date().toISOString(),
    estadoDeEnvioDeSms: estado,
  })

  await newSMS.save();
}

export const sendCustomSMS = async (req, res) => {
  const { telefono, message, remitenteDeSms, codigoDeProducto, producto } = req.body;

  if (!telefono || !message || !remitenteDeSms || !codigoDeProducto || !producto) {
    return res.status(400).json({ error: "Fltan datos requeridos" });
  }

  const hexMessage = toHex(message);

  const { success, error } = await sendSMSProvider(telefono, hexMessage);
  const estado = success ? "Enviado" : "No enviado";

  await saveSMSLog(telefono, message, estado, remitenteDeSms, codigoDeProducto, producto);

  if (success) {
    return res.status(200).json({ message: "SMS enviado exitosamente" })
  } else {
    return res.status(500).json({ error: "Error al enviar el SMS", details: error });
  }
};