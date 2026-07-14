/**
 * SCRIPT PARA CONFIGURAÇÃO NO GOOGLE APPS SCRIPT (Google Drive)
 * 
 * PASSO A PASSO DETALHADO DE INSTALAÇÃO:
 * 
 * 1. Acesse o painel do Google Apps Script: https://script.google.com/
 * 2. No menu esquerdo, clique no botão azul "+ Novo projeto" (ou "New project").
 * 3. No editor que abrir, você verá um arquivo padrão chamado `Código.gs`:
 *    - Apague todo o código existente nele.
 *    - Cole este código completo dentro dele.
 * 4. Salve o projeto clicando no ícone de "Disco" (Salvar projeto) na barra superior ou usando Ctrl + S.
 *    - Dica: Você pode clicar no título "Projeto sem título" lá em cima para renomeá-lo (ex: "ERP Fotos Checkup").
 * 5. No menu superior, clique em "Implantar" (botão azul) > "Nova implantação" (ou "New deployment").
 * 6. Na janela que se abrir:
 *    - Ao lado de "Selecionar tipo", clique no ícone de engrenagem e escolha a opção "Aplicativo da Web" (ou "Web App").
 *    - Preencha as configurações abaixo exatamente assim:
 *      * Descrição: pode escrever "v1" (ou deixar em branco).
 *      * Executar como: selecione "Eu (seu-email@gmail.com)" (Me).
 *      * Quem tem acesso: selecione "Qualquer pessoa" (Anyone) - ISSO É CRÍTICO! Se selecionar outra opção, o ERP e o site não conseguirão salvar nem ler as fotos.
 *    - Clique no botão azul "Implantar" (ou "Deploy") no final da janela.
 * 7. Tela de Autorização (Muito importante!):
 *    - Uma mensagem surgirá dizendo que é necessária autorização. Clique no botão "Autorizar acesso".
 *    - Uma janela do Google se abrirá. Selecione a sua conta do Gmail/Google.
 *    - O Google exibirá um aviso de segurança: "O Google não verificou este app" (Google hasn't verified this app).
 *    - Não se preocupe, isso é padrão para scripts criados por você. Clique no link pequeno escrito "Avançado" (ou "Advanced") no canto inferior esquerdo.
 *    - Em seguida, clique em "Acessar ERP Fotos Checkup (não seguro)" (ou "Go to... (unsafe)") que aparecerá logo abaixo.
 *    - Na tela seguinte, role até o final e clique no botão azul "Permitir" (ou "Allow").
 * 8. Obtendo a URL final:
 *    - Após a conclusão da implantação, uma tela mostrará os detalhes.
 *    - Copie o endereço exibido no campo "URL" (ele termina obrigatoriamente com "/exec", por exemplo: https://script.google.com/macros/s/XXXXX/exec).
 *    - Cole essa URL no campo de configurações do site (ícone de engrenagem no canto superior direito da página).
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
