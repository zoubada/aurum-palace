import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const doc = await io.read(process.argv[2]);
for (const m of doc.getRoot().listMaterials()) {
  const t = (x) => x ? (x.getURI() || x.getMimeType()) + ':' + (x.getSize()||[]).join('x') : '-';
  const cc = m.getExtension('KHR_materials_clearcoat');
  console.log(m.getName().padEnd(24), 'base', m.getBaseColorFactor().map(v=>v.toFixed(2)).join(','), 'm', m.getMetallicFactor().toFixed(2), 'r', m.getRoughnessFactor().toFixed(2), 'alpha', m.getAlphaMode(), 'cc', cc ? cc.getClearcoatFactor().toFixed(2) : '-', 'tex', t(m.getBaseColorTexture()), 'N', t(m.getNormalTexture()), 'MR', t(m.getMetallicRoughnessTexture()), 'E', t(m.getEmissiveTexture()), 'em', m.getEmissiveFactor().map(v=>v.toFixed(1)).join(','));
}
