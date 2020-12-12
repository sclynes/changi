const changi = require('./changi');
const fs = require('fs');

const main = async () => {
    const products = await changi.getAllProducts();
    const parsedProducts = changi.parseProducts(products);

    let multidimensional = {};

    //Filter out products that contain variants
    for (const [key, value] of Object.entries(parsedProducts)){
        if(parsedProducts[key].multidimensional === true) 
            multidimensional[key] = parsedProducts[key]
    }

    const variants = await changi.getVariants(multidimensional);    //Full variant objects
    const parsedVariants = changi.parseVariants(variants.filter(v => v !== undefined))  //Filtered fields

    parsedVariants.forEach(pv => parsedProducts[pv.product].variants = pv.variants); // Map variants back to parent products
  
    fs.writeFileSync(`changi_all_products_${Date.now()}.json`, JSON.stringify(parsedProducts)); 
}

main();