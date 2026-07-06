import zipfile
import xml.etree.ElementTree as ET
import sys
import codecs

sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)

def read_docx(file_path):
    with zipfile.ZipFile(file_path) as docx:
        xml_content = docx.read('word/document.xml')
        tree = ET.fromstring(xml_content)
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        text = []
        for paragraph in tree.findall('.//w:p', ns):
            para_text = []
            for run in paragraph.findall('.//w:r', ns):
                t = run.find('w:t', ns)
                if t is not None and t.text:
                    para_text.append(t.text)
            text.append(''.join(para_text))
        return '\n'.join(text)

print(read_docx("e:/AlgoConnect/AlgoConnect_Complete_Technical_Design_Document.docx"))
