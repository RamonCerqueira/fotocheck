/**
 * SCRIPT PARA DEPLOY NO GOOGLE APPS SCRIPT (Google Drive)
 * 
 * INSTRUÇÕES DE INSTALAÇÃO:
 * 1. Acesse https://script.google.com/
 * 2. Crie um "Novo projeto".
 * 3. Apague todo o código existente no arquivo `Código.gs` e cole este código completo.
 * 4. Salve o projeto (ex: "ERP Fotos Checkup").
 * 5. Clique em "Implantar" (Deploy) > "Nova implantação" (New deployment).
 * 6. Selecione o tipo: "Aplicativo da Web" (Web App).
 * 7. Configure:
 *    - Executar como: "Eu" (Sua conta Google).
 *    - Quem tem acesso: "Qualquer pessoa" (Anyone) - ISSO É CRÍTICO para que o ERP e o script frontend possam enviar/ler as fotos sem login.
 * 8. Clique em "Implantar" e conceda as permissões de acesso ao Google Drive que forem solicitadas.
 * 9. Copie o "URL do aplicativo da Web" gerado e cole nas configurações da página web.
 */

// Nome da pasta no Google Drive onde as fotos serão armazenadas
var FOLDER_NAME = "ERP_Fotos";

/**
 * Retorna as informações da imagem (Visualização/Consulta)
 * URL de teste: URL_DO_SCRIPT?file=23882610000161C5562.JPG
 */
function doGet(e) {
  try {
    var filename = e.parameter.file || e.parameter.filename;
    
    if (!filename) {
      return responseJson({ exists: false, error: "Parâmetro 'file' ausente." });
    }
    
    var folder = getOrCreateFolder(FOLDER_NAME);
    var files = folder.getFilesByName(filename);
    
    if (files.hasNext()) {
      var file = files.next();
      var fileId = file.getId();
      
      // Garante que o arquivo está compartilhado para visualização por qualquer pessoa
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      return responseJson({
        exists: true,
        filename: filename,
        id: fileId,
        url: "https://lh3.googleusercontent.com/d/" + fileId
      });
    } else {
      return responseJson({ exists: false });
    }
  } catch (err) {
    return responseJson({ exists: false, error: err.toString() });
  }
}

/**
 * Recebe o upload da foto em Base64 e salva/substitui no Google Drive
 */
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return responseJson({ success: false, error: "Nenhum dado recebido no corpo da requisição." });
    }
    
    var data = JSON.parse(e.postData.contents);
    var filename = data.filename;
    var rawImage = data.image; // Ex: data:image/jpeg;base64,/9j/4AAQSk...
    
    if (!filename || !rawImage) {
      return responseJson({ success: false, error: "Parâmetros 'filename' ou 'image' ausentes." });
    }
    
    // Tratamento do Base64 da imagem
    var parts = rawImage.split(",");
    var contentType = parts[0].split(":")[1].split(";")[0]; // extrai mime-type (ex: image/jpeg)
    var base64Data = parts[1]; // conteúdo base64 puro
    
    // Decodifica o base64 para um Blob do Google Apps Script
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, contentType, filename);
    
    var folder = getOrCreateFolder(FOLDER_NAME);
    
    // Remove o arquivo antigo com o mesmo nome se ele já existir (evita duplicatas e mantém o Drive limpo)
    var existingFiles = folder.getFilesByName(filename);
    while (existingFiles.hasNext()) {
      var oldFile = existingFiles.next();
      oldFile.setTrashed(true); // move para a lixeira
    }
    
    // Cria o novo arquivo na pasta do Drive
    var newFile = folder.createFile(blob);
    var newFileId = newFile.getId();
    
    // Define a permissão pública de leitura por link (para que o Delphi possa ler a foto diretamente)
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return responseJson({
      success: true,
      filename: filename,
      id: newFileId,
      url: "https://lh3.googleusercontent.com/d/" + newFileId
    });
    
  } catch (err) {
    return responseJson({ success: false, error: err.toString() });
  }
}

/**
 * Função auxiliar para buscar ou criar a pasta de fotos
 */
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    var folder = DriveApp.createFolder(folderName);
    // Compartilha a pasta para leitura pública por padrão (opcional, mas recomendado)
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return folder;
  }
}

/**
 * Converte um objeto JavaScript em resposta JSON com cabeçalhos apropriados
 */
function responseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
