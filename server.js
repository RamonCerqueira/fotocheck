const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Configura CORS para permitir requisições de outras origens
app.use(cors());

// Aumenta o limite do body-parser para suportar imagens em base64 grandes (10MB)
app.use(express.json({ limit: '10mb' }));

// Serve a pasta atual para acessar o index.html diretamente
app.use(express.static(__dirname));

// Serve a pasta de uploads estaticamente para visualização direta das fotos
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

/**
 * Endpoint de Upload (JSON Base64)
 * Recebe: { filename: "NOME.jpg", image: "data:image/jpeg;base64,..." }
 */
app.post('/', (req, res) => {
    const { filename, image } = req.body;

    if (!filename || !image) {
        return res.status(400).json({ success: false, error: 'Parâmetros "filename" ou "image" ausentes.' });
    }

    try {
        // Extrai o conteúdo base64 puro excluindo o prefixo data:image/...
        const parts = image.split(',');
        const base64Data = parts[1];
        
        if (!base64Data) {
            return res.status(400).json({ success: false, error: 'Formato de imagem inválido.' });
        }

        // Converte base64 para Buffer binário
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Caminho físico final do arquivo
        const filePath = path.join(uploadsDir, filename);

        // Escreve o arquivo no disco (se já existir, sobrescreve automaticamente)
        fs.writeFileSync(filePath, buffer);

        console.log(`[SUCESSO] Foto salva: ${filename}`);

        return res.json({
            success: true,
            filename: filename,
            url: `http://localhost:3000/uploads/${filename}`
        });

    } catch (err) {
        console.error('[ERRO] Falha ao salvar arquivo:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Inicialização do servidor na porta 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`Servidor de teste de Fotos iniciado com sucesso!`);
    console.log(`Acesse o frontend em: http://localhost:${PORT}/index.html`);
    console.log(`Exemplo de teste: http://localhost:${PORT}/index.html?file=teste.jpg`);
    console.log(`As fotos enviadas serão salvas em: ${uploadsDir}`);
    console.log(`======================================================\n`);
});
