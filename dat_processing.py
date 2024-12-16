
import os
import pandas as pd

# File paths for each year of occupied datasets
OCC_FILE_PATHS = {
    1991: "DATA/1991/occ91ufl99.dat",
    1993: "DATA/1993/occ93ufl99.dat",
    1996: "DATA/1996/occ96ufl99.dat",
    1999: "DATA/1999/occ99ufl99.dat",
    2002: "DATA/2002/lng08_occ02_rev.dat",
    2005: "DATA/2005/lng08_occ05_rev.dat",
    2008: "DATA/2008/lng08_occ08_rev.dat",
    2011: "DATA/2011/uf_11_repwgt_occ_web.txt",
    2014: "DATA/2014/uf_14_repwgt_occ_web.txt",
    2017: "DATA/2017/uf_17_occ_web_b.txt",
}

# File paths for each year of vacant datasets
VAC_FILE_PATHS = {
    1991: "DATA/1991/vac91ufl99.dat",
    1993: "DATA/1993/vac93ufl99.dat",
    1996: "DATA/1996/vac96ufl99.dat",
    1999: "DATA/1999/vac99ufl99.dat",
    2002: "DATA/2002/lng08_vac02_web.dat",
    2005: "DATA/2005/lng08_vac05_web.dat",
    2008: "DATA/2008/lng08_vac08_web.dat",
    2011: "DATA/2011/uf_11_repwgt_vac_web.txt",
    2014: "DATA/2014/uf_14_repwgt_vac_web.txt",
    2017: "DATA/2017/uf_17_vac_web_b.txt"
}

# Character mapping for each variable per year, this is to tell the program where it should be looking in the .dat file 
YEAR_CONFIGS = {
    1991: {"borough": (2, 2), "gross_monthly_rent": (196, 199), "vacancy_status": (47, 47), "income": (215,220)},
    1993: {"borough": (2, 2), "gross_monthly_rent": (196, 199), "vacancy_status": (47, 47), "income": (215,220)},
    1996: {"borough": (2, 2), "gross_monthly_rent": (196, 199), "vacancy_status": (47, 47), "income": (215,220)},
    1999: {"borough": (2, 2), "gross_monthly_rent": (233, 236), "vacancy_status": (55, 55), "income": (246,251)},
    2002: {"borough": (2, 2), "gross_monthly_rent": (238, 241), "vacancy_status": (55, 55), "income": (251,257)},
    2005: {"borough": (2, 2), "gross_monthly_rent": (288, 291), "vacancy_status": (55, 55), "income": (301,307)},
    2008: {"borough": (2, 2), "gross_monthly_rent": (445, 448), "vacancy_status": (55, 55), "income": (458,464)},
    2011: {"borough": (2, 2), "gross_monthly_rent": (445, 449), "vacancy_status": (55, 55), "income": (459,465)},
    2014: {"borough": (2, 2), "gross_monthly_rent": (445, 449), "vacancy_status": (55, 55), "income": (459,465)},
    2017: {"borough": (2, 2), "gross_monthly_rent": (445, 449), "vacancy_status": (54, 54), "income": (459,465)}
}

# Which variables to use when looking through OCC and VAC .dat files respectively, borough has the same mapping for both
OCC_VARIABLES = {"borough", "gross_monthly_rent", "income"}
VAC_VARIABLES = {"borough", "vacancy_status"}

def parse_dat_file(file_path, year, variables):
    config = YEAR_CONFIGS[year]
    data = []

    with open(file_path, "r") as file:
        for line in file:
            record = {}
            for variable in variables:
                start, end = config[variable]
                record[variable] = line[start - 1:end].strip()
            data.append(record)

    return pd.DataFrame(data)

def process_files(file_paths, variables, file_prefix):
    for year, file_path in file_paths.items():
        print(f"Processing file for year {year}: {file_path}")
        
        df = parse_dat_file(file_path, year, variables)
        
        output_dir = os.path.dirname(file_path)
        output_file = os.path.join(output_dir, f"{file_prefix}_data_{year}.csv") #Creates file, so occ_data_1991.csv within data/1991
        
        df.to_csv(output_file, index=False)
        print(f"Saved parsed data to {output_file}")

# Process the .dat files for relevant OCC and VAC datasets
process_files(OCC_FILE_PATHS, OCC_VARIABLES, "occ")
process_files(VAC_FILE_PATHS, VAC_VARIABLES, "vac")
