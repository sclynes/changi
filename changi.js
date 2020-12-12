
const request = require('request');
const ProgressBar = require('progress');
const Bottleneck = require('bottleneck');

const getAllProducts = async () => {
    console.log('Retrieving Products');
    var bar = new ProgressBar(`[:bar] :rate/pps :percent :etas`, {complete: '=', incomplete: ' ', width: 30, total: 1});
    const limiter = new Bottleneck({minTime: 10, maxConcurrent: 50}); //set up request limiter
    const limitedQuery = limiter.wrap(getAllProductsRequest);   //limit the provided function

    let currentPage = 0;
    let results = [];

    let response = await getAllProductsRequest(currentPage); //get first page to gather total page info
    const numberOfPages = response.pagination.totalPages;

    bar.total = numberOfPages;
    bar.tick(1);    //update progress bar
    results.push(...response.products); //add first page to final result


    if(currentPage > numberOfPages) return results;
    currentPage++;

    let allRequests = [];
    for (let i = currentPage; i <= numberOfPages; i++) {
        allRequests.push(limitedQuery(i)
        .then(res => {
            bar.tick(1);    //Each time a request is fulfilled then update progress bar
            return res;
        }));
    }
    const responses = await Promise.all(allRequests); //Wait for all requests to return
    results.push(...responses.map(r => r.products));
    return flatten(results); //flatten so that the array contains just products rather than products per request sub arrays
}

const getAllProductsRequest = async page => { 
    //referer header needed here, blocked without
    const options = {
        method: "GET",
        url: "https://www.ishopchangi.com/bin/cagcommerce/webservices/v2/cag/products/search.json?pageSize=100&currentPage="+page+"&query=::cagCategory:%2Fbeauty&categoryCodes=travel-electronics-chargers,beauty,food,Womens-fashion&lang=en",
        headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.100 Safari/537.36",
            "content-type": "application/json",  
            "accept": "application/json, text/plain, */*",
            "referer": "https://www.ishopchangi.com/en/categories?cagCategory=%7B%22%2Fwine-and-spirits%22%3A%5B%22%2Fwine-and-spirits%2Fspirits-sake",
            "accept-language": "en-GB,en;q=0.9",
        }
    }

    return new Promise( (resolve, reject) => 
    request(options, (err, res, body) => {
        if (err) reject(err);
        else {
            const json = JSON.parse(body);
            resolve(json);
        }
    })
)}

const getVariants = async products => {
    console.log("Retrieving Variants");
    const bar = new ProgressBar(`[:bar] :rate/pps :percent :etas`, {complete: '=', incomplete: ' ', width: 30, total: 1});
    const limiter = new Bottleneck({minTime: 20, maxConcurrent: 50});
    const limitedQuery = limiter.wrap(getVariantsRequest);
    bar.total = Object.entries(products).length;

    let allRequests = [];
    for (const [key, value] of Object.entries(products)){
        allRequests.push(limitedQuery( `https://www.ishopchangi.com${products[key].url.split('.')[0]}.model.json`)
        .then(res => {
            bar.tick(1); 
            if(res[":items"].root[":items"].responsivegrid[":items"].productpage)
                return {
                    product: res[":items"].root[":items"].responsivegrid[":items"].productpage.productId,
                    variants:  res[":items"].root[":items"].responsivegrid[":items"].productpage.product.variantOptions
                }
        }));
    }
    return await Promise.all(allRequests);
}

const getVariantsRequest = async url => {
    const options = {
        method: "GET",
        url: url,
        headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.100 Safari/537.36",
            "content-type": "application/json",  
            "accept": "application/json, text/plain, */*",
            "referer": "https://www.ishopchangi.com/en/categories?cagCategory=%7B%22%2Fwine-and-spirits%22%3A%5B%22%2Fwine-and-spirits%2Fspirits-sake",
            "accept-language": "en-GB,en;q=0.9",
        }
    }

    return new Promise( (resolve, reject) => 
    request(options, (err, res, body) => {
        if (err) reject(err);
        else { 
            const json = JSON.parse(body);
            resolve(json);
        }
    })
)}

const parseProducts = products => {
    //reduce products to desired fields
    productMap = {};
    products.forEach(p => {
        productMap[p.code] = {};
        productMap[p.code].name = p.name;
        productMap[p.code].manufacturer = p.manufacturer;
        productMap[p.code].multidimensional = p.multidimensional;
        productMap[p.code].inStock = p.inStock;
        productMap[p.code].url = p.url;
        if(p.price) {
            productMap[p.code].price = p.price.value;
            productMap[p.code].currency = p.price.currencyIso;
        } else productMap[p.code].price = productMap[p.code].currency = 'na';
    })
    return productMap;
}

const parseVariants = products => {
    //reduce variants for desired fields
    for (const [key, value] of Object.entries(products)){
        products[key].variants = products[key].variants.map(v => {
            let variant = {};
            variant.code = v.code;
            variant.offers = v.offers.map(o => o.channelPrices.map(cp => {
                return {"channel": cp.channelCode, "discountedPrice": cp.enDiscountedPrice, "shopName": o.shopName}
            }))
            variant.classifications = v.classifications;
            return variant;
        })
    }
    return products;
}

function flatten(arr) {
    return arr.reduce(function (flat, toFlatten) {
      return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
    }, []);
}

module.exports = {
    getAllProducts,
    getVariants,
    parseProducts,
    parseVariants
}