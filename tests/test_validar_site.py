"""Regressões da validação de dependências JavaScript do artefato."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools import validar_site


class ImportacoesJavaScriptTest(unittest.TestCase):
    def test_dependencias_estaticas_e_dinamicas_em_subpastas(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            core = root / "js" / "core"
            core.mkdir(parents=True)
            (root / "js" / "feature.js").write_text("export const value = 1;", encoding="utf-8")
            (core / "bootstrap.js").write_text(
                'import { value } from "../feature.js";\n'
                "import '../feature.js';\n"
                "export { value } from '../feature.js';\n"
                "const load = () => import(\n  '../feature.js'\n);\n",
                encoding="utf-8",
            )
            errors = []
            with patch.object(validar_site, "RAIZ", root):
                count = validar_site.validar_importacoes_js(errors)
            self.assertEqual(count, 4)
            self.assertEqual(errors, [])

    def test_import_dinamico_ausente_indica_arquivo_e_linha(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "js").mkdir()
            (root / "js" / "main.js").write_text(
                "const page = 'gallery';\nconst load = () => import('./missing.js');\n",
                encoding="utf-8",
            )
            errors = []
            with patch.object(validar_site, "RAIZ", root):
                validar_site.validar_importacoes_js(errors)
            self.assertEqual(len(errors), 1)
            self.assertIn("js/main.js:2:", errors[0])
            self.assertIn("./missing.js", errors[0])


class TimelineTest(unittest.TestCase):
    def criar_acervo(self, root, eventos, arquivos):
        (root / "data").mkdir(parents=True)
        (root / "data" / "timeline.json").write_text(json.dumps(eventos), encoding="utf-8")
        for arquivo in arquivos:
            destino = root / "imagens" / arquivo
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(b"x")

    def validar(self, eventos, arquivos):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.criar_acervo(root, eventos, arquivos)
            errors = []
            with patch.object(validar_site, "RAIZ", root):
                validar_site.validar_timeline(errors)
            return errors

    def evento(self, foto, miniatura):
        return [{
            "categoria": "escolas", "data": "2024", "caminho_relativo": "escolas/2024",
            "fotos": [foto],
            "metadados": {foto: {"largura": 10, "altura": 10, "miniatura": miniatura}},
        }]

    def test_jpg_legado_com_miniatura_de_outro_nome(self):
        errors = self.validar(
            self.evento("foto (1).jpg", "escolas/2024/foto (1)-miniatura.jpg"),
            ["galeria/escolas/2024/foto (1).jpg", "miniaturas/escolas/2024/foto (1)-miniatura.jpg"],
        )
        self.assertEqual(errors, [])

    def test_imagem_e_miniatura_ausentes_sao_apontadas(self):
        errors = self.validar(self.evento("nova.webp", "escolas/2024/nova.webp"), [])
        self.assertEqual(len(errors), 2)
        self.assertTrue(any("imagem não encontrada" in erro for erro in errors))
        self.assertTrue(any("miniatura não encontrada" in erro for erro in errors))

    def test_miniatura_fora_da_pasta_do_evento(self):
        errors = self.validar(
            self.evento("nova.webp", "../segredo.webp"),
            ["galeria/escolas/2024/nova.webp"],
        )
        self.assertEqual(len(errors), 1)
        self.assertIn("caminho de miniatura inválido", errors[0])


if __name__ == "__main__":
    unittest.main()
