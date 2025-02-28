// Make an HTTP request through the Obsidian interface, but have a timeout failsafe
import {requestUrl} from "obsidian";

export function fetchWithTimeout(url : string, secret : string , bodyContents : Record<string, string>, timeoutMs: number) {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			resolve({ status : 404 });
		}, timeoutMs);
		const requestBody = JSON.stringify(bodyContents)
		requestUrl({url : url,
			method : 'POST',
			headers : {
				'Content-Type' : 'application/json',
				'Authorization' : `Bearer ${secret}`
			},
			body: requestBody})
			.then((response) => {
				clearTimeout(timeout);
				resolve(response);
			})
	});
}

// export function fetchFormWithTimeout(url : string, secret : string , formData : FormData, timeoutMs: number) {
// 	return new Promise((resolve, reject) => {
// 		const timeout = setTimeout(() => {
// 			resolve({ status : 404 });
// 		}, timeoutMs);
// 		requestUrl({url : url,
// 			method : 'POST',
// 			contentType : 'application/json',
// 			body: formData})
// 			.then((response) => {
// 				clearTimeout(timeout);
// 				resolve(response);
// 			})
// 	});
// }
