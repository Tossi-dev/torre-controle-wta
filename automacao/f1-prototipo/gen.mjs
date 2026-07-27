import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const zip = new PizZip(fs.readFileSync('template_ASO.docx','binary'));
const doc = new Docxtemplater(zip, {paragraphLoop:true, linebreaks:true});
doc.render({
  razao_social:'Transportes Modelo Ltda', cnpj:'12.345.678/0001-90', cnae:'4930-2/02',
  endereco:'Av. das Indústrias, 1000 - Uberlândia/MG',
  nome_trabalhador:'João da Silva Pereira', cpf:'123.456.789-00', nascimento:'15/03/1988',
  cargo:'Motorista de Caminhão', setor:'Logística', riscos:'Ruído; Vibração de corpo inteiro',
  tipo_exame:'Periódico', data_exame:'27/07/2026', exames_complementares:'Audiometria; Acuidade Visual',
  conclusao:'APTO para a função', observacoes:'Uso obrigatório de protetor auricular',
  medico:'Dra. Maria Souza', crm:'CRM-MG 123456', data_emissao:'27/07/2026'
});
const buf = doc.getZip().generate({type:'nodebuffer'});
fs.writeFileSync('ASO_exemplo.docx', buf);
console.log('ASO_exemplo.docx gerado —', buf.length, 'bytes');
